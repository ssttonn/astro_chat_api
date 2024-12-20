import multer from "multer";
import multerS3 from "multer-s3";
import { AuthenticatedRequest } from "../models/types";
import { s3 } from "../services/aws";
import { HttpError } from "../utils";
import dotenv from "dotenv";

// Set up multer to use S3 storage
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME as string,
    metadata: function (_: any, file: any, cb: any) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req: AuthenticatedRequest, file: any, cb: any) {
      if (!file) {
        cb(new HttpError(400, "Please upload an image file"), undefined);
      } else {
        cb(
          null,
          `avatars/${req.authUser?._id}.${file.originalname.split(".").pop()}`
        );
      }
    },
  }),
  limits: { fileSize: 1024 * 1024 * 2 }, // Limit file size to 2MB
  fileFilter: (_, file, cb) => {
    if (file && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new HttpError(400, "Please upload an image file"));
    }
  },
});

export default upload;
