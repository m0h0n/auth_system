import express from "express";
import parser, { json } from "body-parser";
import { connect } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import rateLimiter from "express-rate-limit";
import joiValid from "./joiValidation";
require("dotenv").config();
import jwtToken from "./jwtToken";
import User from "./models/User";
const app = express();

const port = process.env.PORT || 8000;
// set salt CONST
const salt: number = 12;

// types
interface userInfoType {
  username: string;
  password: string;
  email: string;
}
interface respType {
  username: string;
  email: string;
  jwtToken: string;
}
//
//
//

const verifyLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 min window
  max: 6, // start blocking after 6 requests
  message: "Too many Request",
});

// middlewares
app.use(parser.json());
// connect to mongo db

connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/test",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  (err) => {
    if (!err) {
      console.log("db is ok!!");
    } else {
      console.log(err);
    }
  }
);

// frontend post email password and username we check for unique and make a coluumn and return jwt if its not unique err
app.post("/api/auth/create", (req: express.Request, res: express.Response) => {
  //post body
  const body = req.body;
  // valid datas with Joi
  const validation = joiValid.validate(body);
  if (validation.error) {
    return res.json({ err: validation.error });
  }
  // hash password and put it in db
  bcrypt.hash(body.password, salt, (err, hash) => {
    if (!err) {
      const userInfo: userInfoType = {
        username: body.username,
        password: hash,
        email: body.email,
      };

      const user = new User(userInfo);
      user.save((error) => {
        if (error) {
          res.json(error.message);
        } else {
          const resp: respType = {
            username: body.username,
            email: body.email,
            jwtToken: jwt.sign(user._id.toString(), jwtToken),
          };
          res.json(resp);
        }
      });
    } else {
      res.json(err);
    }
  });
});

// front end post username and password and we check and return if true jwt if not true err
app.post(
  "/api/auth/verify",
  verifyLimiter,
  (req: express.Request, res: express.Response) => {
    //post body
    const body = req.body;
    //check "username" and "password " is exist
    if (body.username && body.password) {
      // check typeof password and username
      if (
        typeof body.username !== "string" ||
        typeof body.password !== "string"
      ) {
        return res.json({ err: "please enter correct values" });
      }
      // check "username" is username or email
      // if is_email = -1 means its username if is_email != -1 means its username
      const is_email: number = body.username.search(/^.*@.*$/);
      if (is_email == -1) {
        // its username
        User.find({ username: body.username }, (err, docs) => {
          if (docs.length > 0) {
            const passHash = docs[0].get("password");

            bcrypt.compare(body.password, passHash, (err, is_same) => {
              if (!err) {
                if (is_same) {
                  return res.json({
                    valid: true,
                    jwtToken: jwt.sign(docs[0]._id.toString(), jwtToken),
                  });
                } else {
                  return res.json({ valid: false });
                }
              }
            });
          } else {
            return res.json({ valid: false });
          }
        });
      } else {
        // its email
        User.find({ email: body.username }, (err, docs) => {
          if (docs.length > 0) {
            const passHash = docs[0].get("password");

            bcrypt.compare(body.password, passHash, (err, is_same) => {
              if (!err) {
                if (is_same) {
                  return res.json({
                    valid: true,
                    jwtToken: jwt.sign(docs[0]._id.toString(), jwtToken),
                  });
                } else {
                  return res.json({ valid: false });
                }
              }
            });
          } else {
            return res.json({ valid: false });
          }
        });
      }
    } else {
      return res.json({ err: "please enter correct values" });
    }
  }
);
const authjwt = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const header = req.headers.authorization;
  if (!header) return res.json({ err: true });
  const token = header.split(" ")[1];
  jwt.verify(token, jwtToken, (err, decoded) => {
    if (err) return res.json({ err: true });

    req.userID = decoded;
    next();
  });
};

app.get("/api/auth/info", authjwt, (req, res) => {
  User.find({ _id: req.userID }, (err, docs) => {
    if (err) return res.json({ err: true });
    if (docs.length > 0) {
      res.json({
        username: docs[0].get("username"),
        email: docs[0].get("email"),
      });
    }
  });
});

// run server on port
app.listen(port, () => console.log(`Im running on port ${port}`));
