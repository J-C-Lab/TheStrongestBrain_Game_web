//《羊了个羊》游戏逻辑

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../auth');
const { recordGameResult } = require('../../utils/gameEngine');

router.post('/deal', authenticateToken, (req, res) => {
    const{ gameId , timeSpent , difficulty , result , score }=req.body;
    const userId = req.user.userId;
    if (!gameId) return res.status(400).json({ error: '提交失败：前端传过来的 gameId 是空的！' });
    recordGameResult(userId,gameId,difficulty,result,timeSpent);
    res.json({ message: '结算成功', currentScore: score });
});


module.exports = router;