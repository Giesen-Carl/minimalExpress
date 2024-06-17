import { DataTypes } from 'sequelize';
import sequelize from '../sqliteDatabaseConfig.js';

const User = sequelize.define('User', {
    username: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    first_name: {
        type: DataTypes.STRING,
    },
    last_name: {
        type: DataTypes.STRING,
    }
});

export default User;
