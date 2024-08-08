const multerS3 = require('multer-s3');
const multer = require('multer');
const { s3 } = require('../services/aws');
const { HttpError } = require('../utils');

// Set up multer to use S3 storage
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    metadata: function (_, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      if (!file) {
        cb(new HttpError(400, "Please upload an image file"), false);
      }

      cb(null, `avatars/${req.authUser._id}.${file.originalname.split('.')[file.originalname.split('.').length - 1]}`);
    }
  }),
  limits: { fileSize: 1024 * 1024 * 2 }, // Limit file size to 2MB
  fileFilter: (_, file, cb) => {
    if (file && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new HttpError(400, "Please upload an image file"), false);
    }
  }
});

module.exports = upload;