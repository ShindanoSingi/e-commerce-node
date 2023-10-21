const Product = require('../models/productModel');
const User = require('../models/userModel');
const asyncHandler = require('express-async-handler');
const slugify = require('slugify');
const { response } = require('express');
const { validateMongoDbId } = require('../utils/validateMongoDbId');
const cloudinaryUploadImg = require('../utils/cloudinary');
const fs = require('fs');

const createProduct = asyncHandler(async (req, res) => {
    try {
        if (req.body.title) {
            req.body.slug = slugify(req.body.title);
        }
        const newProduct = await Product.create(req.body)
        res.json(newProduct)
    } catch (error) {
        throw new Error(error);
    }
});

const updateProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        if (req.body.title) {
            req.body.slug = slugify(req.body.title);
        }
        const updatedProduct = await Product.findByIdAndUpdate(id, req.body, { new: true });
        res.json(updatedProduct)
    } catch (error) {
        throw new Error(error);
    }
});

const deleteProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const findProduct = await Product.findByIdAndUpdate(id);

    if (!findProduct) {
        res.json({
            message: 'Product not found!'
        });
    }

    try {
        const deleteProduct = await Product.findByIdAndDelete(id);
        res.json(
            { message: 'Product deleted successfully!' })
    } catch (error) {
        throw new Error(error);
    }
});

const getaProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const findProduct = await Product.findById(id);
        if (!findProduct) {
            res.json({ message: `The product does not exist` })
        }
        res.json(findProduct)
    } catch (error) {
        throw new Error(error);
    }
});

const getAllProducts = asyncHandler(async (req, res) => {
    try {
        // Filtering
        const queryObj = { ...req.query };
        const excludeFields = ['page', 'sort', 'limit', 'fields'];
        excludeFields.forEach(field => delete queryObj[field]);

        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

        let query = Product.find(JSON.parse(queryStr));

        // Sorting
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy)
        } else {
            query = query.sort('-createdAt')
        }
        // Limiting the fields
        if (req.query.fields) {
            const fields = req.query.fields.split(',').join(' ');
            query = query.select(fields);
        } else {
            query = query.select('-__v');
        }

        // Pagination
        const page = req.query.page;
        const limit = req.query.limit;
        const skip = (page - 1) * limit;

        query = query.skip(skip).limit(limit);

        if (req.query.page) {
            const productCount = await Product.countDocuments();
            if (skip >= productCount) throw new Error(`This Page does not exist!`);
        }

        console.log(page, limit, skip);

        const getAllProducts = await Product.find({});
        if (!getAllProducts) {
            res.json({ message: `The are no products!` })
        }
        const product = await query;
        res.json({
            sum: product.length, product: product
        });
    } catch (error) {
        throw new Error(error);
    }
});

const addToWishlist = asyncHandler(async (req, res) => {
    const { id } = req.user;
    const { prodId } = req.body;
    try {
        const user = await User.findById(id);
        const alreadyadded = user.wishlist.find((id) => id.toString() === prodId);
        if (alreadyadded) {
            let user = await User.findByIdAndUpdate(id, {
                $pull: { wishlist: prodId },
            },
                {
                    new: true,
                }
            );
            res.json(user);
        } else {
            let user = await User.findByIdAndUpdate(id, {
                $push: { wishlist: prodId },
            },
                {
                    new: true,
                }
            );
            res.json(user);
        }
    } catch (error) {
        throw new Error(error);
    };
})

const rating = asyncHandler(async (req, res) => {
    const { id } = req.user;
    let { star, prodId, comment } = req.body;

    try {
        if (star > 5) star = 5;
        if (star < 1) star = 0;
        const product = await Product.findById(prodId);
        let alreadyRated = product.ratings.find((userId) => userId.postedby.toString() === id.toString());
        if (alreadyRated) {
            const updateRating = await Product.updateOne(
                {
                    ratings: { $elemMatch: alreadyRated },
                },
                {
                    $set: { "ratings.$.star": star, "ratings.$.comment": comment },
                },
                {
                    new: true,
                }
            );
            // res.json(updateRating);

        } else {
            const rateProduct = await Product.findByIdAndUpdate(prodId, {
                $push: {
                    ratings: {
                        star: star,
                        comment: comment,
                        postedby: id,
                    },
                },
            },
                {
                    new: true,
                }
            );
        }
        const getallratings = await Product.findById(prodId);
        let totalRating = getallratings.ratings.length;
        let ratingSum = getallratings.ratings.map((item) => item.star).reduce((prev, current) => prev + current, 0);
        let actualRating = Math.round(ratingSum / totalRating);
        let finalProduct = await Product.findByIdAndUpdate(
            prodId,
            {
                totalrating: actualRating,
            },
            {
                new: true,
            }
        );
        res.json(finalProduct);
    } catch (error) {
        throw new Error(error);
    }
});

const uploadImages = asyncHandler(async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id);
    try {
        const uploader = (path) => cloudinaryUploadImg(path, "images");
        const urls = [];
        const files = req.files;

        for (const file of files) {
            const { path } = file;
            const newpath = await uploader(path);

            urls.push(newpath);
            fs.unlinkSync(path);
        }
        const findProduct = await Product.findByIdAndUpdate(id, {
            images: urls.map((file) => {
                return file;
            }),
        }, {
            new: true,
        })

        res.json(findProduct);
    } catch (error) {
        throw new Error(error);
    }
})

module.exports = { createProduct, getaProduct, getAllProducts, updateProduct, deleteProduct, addToWishlist, rating, uploadImages };