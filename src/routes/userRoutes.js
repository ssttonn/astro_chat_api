const express = require('express')

const router = express.Router()

const userController = require('../controllers/userController')

const { param } = require('express-validator')

router.get("/search", userController.searchUsers)

router.get("/:identifier", [
    param('identifier').not().isEmpty().withMessage('Identifier is required')
], userController.userDetail)

module.exports = router