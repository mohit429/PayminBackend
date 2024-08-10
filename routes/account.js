
const express = require('express');
const { authMiddleware } = require('../middleware');
const { Account,Transaction} = require('../db');
const { default: mongoose } = require('mongoose');

const router = express.Router();

router.get("/balance", authMiddleware, async (req, res) => {
    try {
        const { userId } = req.query;
        const account = await Account.findOne({ userId });

        if (!account) {
            return res.status(404).json({ error: "Account not found" });
        }

        res.json(account.balance);
    } catch (error) {
        console.error("Error fetching account balance:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/transfer", authMiddleware, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    const { amount, to } = req.body;

    const account = await Account.findOne({ userId: req.userId }).session(session);
    if (!account || account.balance < amount) {
        await session.abortTransaction();
        return res.status(400).json({
            message: "Insufficient balance"
        });
    }

    const toAccount = await Account.findOne({ userId: to }).session(session);
    if (!toAccount) {
        await session.abortTransaction();
        return res.status(400).json({
            message: "Invalid account"
        });
    }

    await Account.updateOne({ userId: req.userId }, { $inc: { balance: -amount } }).session(session);
    await Account.updateOne({ userId: to }, { $inc: { balance: amount } }).session(session);

    // Log the transaction
    const transaction = new Transaction({
        from: req.userId,
        to,
        amount
    });
    await transaction.save({ session });

    await session.commitTransaction();
    res.status(200).json({
        message: "Transfer successful"
    });
});

router.get("/history", authMiddleware, async (req, res) => {
    try {
        const transactions = await Transaction.find({
            $or: [
                { from: req.userId },
                { to: req.userId }
            ]
        }).populate('from to', 'username').sort({ date: -1 });

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: "Error fetching transaction history" });
    }
});

module.exports = router;