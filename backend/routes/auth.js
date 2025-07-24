const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// POST /api/auth/login
router.post(
    '/login',
    [
        body('username', 'Имя пользователя не может быть пустым').not().isEmpty(),
        body('password', 'Пароль не может быть пустым').not().isEmpty(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        try {
            // Find user by username
            const user = await User.findOne({ where: { username } });
            if (!user) {
                return res.status(401).json({ message: 'Неверные учетные данные' });
            }

            // Check password
            const isMatch = await user.isValidPassword(password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Неверные учетные данные' });
            }

            // User is authenticated, create JWT
            const payload = {
                user: {
                    id: user.id,
                    username: user.username,
                },
            };

            jwt.sign(
                payload,
                process.env.JWT_SECRET || 'your_default_secret_key',
                { expiresIn: '7d' }, // Token expires in 7 days
                (err, token) => {
                    if (err) throw err;
                    res.json({ 
                        success: true, 
                        token, 
                        message: 'Успешная авторизация' 
                    });
                }
            );
        } catch (error) {
            console.error('Login error:', error.message);
            res.status(500).send('Ошибка сервера');
        }
    }
);

module.exports = router;
