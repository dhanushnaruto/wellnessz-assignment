const express = require("express");
const multer = require("multer");
const aws = require("aws-sdk");
const multerS3 = require("multer-s3");
const dotenv = require("dotenv");
const { sequelize, Post } = require("./models");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// AWS S3 Configuration
const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: "public-read", // make uploaded file publicly accessible
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + "-" + file.originalname);
    },
  }),
});

// Middleware
app.use(express.json());

// Routes
app.get("/posts", async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Sorting
    const sortField = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder || "DESC";

    // Filtering
    const keyword = req.query.keyword || "";
    const tag = req.query.tag || "";

    const posts = await Post.findAndCountAll({
      where: {
        [sequelize.Op.or]: [
          { title: { [sequelize.Op.iLike]: `%${keyword}%` } },
          { desc: { [sequelize.Op.iLike]: `%${keyword}%` } },
        ],
        tag: { [sequelize.Op.iLike]: `%${tag}%` },
      },
      order: [[sortField, sortOrder]],
      limit,
      offset,
    });

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

app.post("/posts", upload.single("image"), async (req, res) => {
  try {
    const { title, desc, tag } = req.body;
    const imageURL = req.file.location; // Image URL from AWS S3

    const newPost = await Post.create({ title, desc, tag, imageURL });
    res.status(201).json(newPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Start the server
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
