const express = require("express");
const router = express.Router();
const zod = require("zod");
const { User, Account } = require("../db");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");
const { authMiddleware } = require("../middleware");

const signupBody = zod.object({
    username: zod.string().email(),
    firstName: zod.string(),
    lastName: zod.string(),
    password: zod.string()
});

// Signup route
router.post("/signup", async (req, res) => {
    const { success, data } = signupBody.safeParse(req.body);
    if (!success) {
        return res.status(400).json({
            message: "Incorrect inputs"
        });
    }

    // Check if the email is already taken
    const existingUser = await User.findOne({ username: data.username });
    if (existingUser) {
        return res.status(409).json({
            message: "Email already taken"
        });
    }

    // Create the user
    const user = await User.create({
        username: data.username,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
    });

    // Create an account for the user
    await Account.create({
        userId: user._id,
        balance: Math.ceil(1 + Math.random() * 10000)
    });

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);

    res.json({
        message: "User created successfully",
        token: token
    });
});

const signinBody = zod.object({
    username: zod.string().email(),
	password: zod.string()
})

// Signin route
router.post("/signin", async (req, res) => {
    const { success, data } = signinBody.safeParse(req.body);
    if (!success) {
         res.status(400).json({
            message: "Incorrect inputs"
        });
        return;
    }

    const user = await User.findOne({
        username: data.username,
        password: data.password
    });
    if (user) {
        const token = jwt.sign({
            userId: user._id
        }, JWT_SECRET);

        res.status(200).json({
            token: token
        });
        return;
    }

    res.status(401).json({
        message: "Invalid username or password"
    });
});

const updateBody = zod.object({
	password: zod.string().optional(),
    firstName: zod.string().optional(),
    lastName: zod.string().optional(),
})

// Bulk route
router.get("/bulk", async (req, res) => {
    const filter = req.query.filter || "";
    const { userId } = req.query;
    const users = await User.find({
        $and: [
            {
                $or: [
                    { firstName: { $regex: filter, $options: 'i' } },
                    { lastName: { $regex: filter, $options: 'i' } }
                ]
            },
            { _id: { $ne: userId } }
        ]
    });

    res.json({
        user: users.map(user => ({
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            _id: user._id
        }))
    });
});

//onendonly

router.get("/onendonly", async (req, res) => {
    try {
        const { username } = req.query;
        const user = await User.findOne({
            username 
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json((user._id));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});



module.exports = router;
