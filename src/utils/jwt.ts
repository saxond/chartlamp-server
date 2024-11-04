// import config from "config";
import fs from 'fs';
import jwt from "jsonwebtoken";

// const publicKeyStr = process.env.PUBLIC_KEY as string;
const publicKey = fs.readFileSync('public_key.pem');  // get public key

const privateKey = fs.readFileSync('private_key.pem');  // get private key

// const publicKey = Buffer.from(publicKeyStr, "base64").toString("ascii");
// const privateKey = Buffer.from(privateKeyStr, "base64").toString("ascii");

export function signJwt(object: Object, options?: jwt.SignOptions | undefined) {
    return jwt.sign(object, privateKey.toString(), {
      ...(options && options),
      algorithm: "PS256",
    });
  }
  

export function verifyJwt<T>(token: string): T | null {
  try {
    const decoded = jwt.verify(token, publicKey.toString()) as T;
    return decoded;
  } catch (e) {
    return null;
  }
}