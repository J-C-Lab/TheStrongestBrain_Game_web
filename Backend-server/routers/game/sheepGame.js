//《羊了个羊》游戏逻辑

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../auth');
const { recordGameResult } = require('../../utils/gameEngine');

const SCORE_RULES = [
  { threshold: 300, score: 20 },  // 5分钟
  { threshold: 600, score: 10 },  // 10分钟
  { threshold: 1200, score: 5 },  // 20分钟
  { threshold: Infinity, score: 0 }
];

// const payload = {
//         gameId: 'sheep-game',
//         timeSpent: seconds,
//         difficulty: difficulty,
//         result: finalState, // 'won' 或 'lost'
//         score: score
//     };

router.get('/deal', authenticateToken, (req, res) => {
    const{ gameId , timeSpent , difficulty , result , score }=req.body;
    const userId = req.user.userId;
    if (!gameId) return res.status(400).json({ error: '提交失败：前端传过来的 gameId 是空的！' });
    recordGameResult(userId,gameId,difficulty,result,timeSpent);
});


module.exports = router;