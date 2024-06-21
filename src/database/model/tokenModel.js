import { DataTypes } from 'sequelize';
import database from '../database.js';

const Token = database.define('Token', {
    token: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    expires: {
        type: DataTypes.DATE,
        allowNull: false,
    }
}, {
    tableName: 'Token',
    timestamps: false
});

export default Token;