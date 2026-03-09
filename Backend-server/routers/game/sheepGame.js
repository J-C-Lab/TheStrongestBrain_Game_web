//《羊了个羊》游戏逻辑

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../auth');
const { recordGameResult } = require('../../utils/gameEngine');

router.post('/deal', authenticateToken, (req, res) => {
    const{ gameId , timeSpent , difficulty , result , score , playCount ,winCount }=req.body;
    const userId = req.user.userId;
    console.log(req.body);
    if (!gameId) return res.status(400).json({ error: '提交失败：前端传过来的 gameId 是空的！' });
    const difficultyMap = {
      '简单':1,
      '中等':2,
      '困难':3
    }
    const iswin = result === 'won'? true : false; 
    const diff = difficultyMap[difficulty] || 1;
    recordGameResult( userId, gameId, diff, iswin, timeSpent, score, playCount, winCount);
    res.json({ message: '结算成功', currentScore: score });
});


module.exports = router;