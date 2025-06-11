import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { 
  createUserNode, 
  createConnectionRequest, 
  acceptConnectionRequest,
  getPendingRequests,
  getUserConnections,
  removeConnection
} from '../config/neo4j.js';

dotenv.config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

const resolvers = {
  Query: {
    me: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      return user;
    },

    searchUser: async (_, { emailOrMobile }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const foundUser = await User.findOne({
        $or: [
          { email: emailOrMobile },
          { mobile: emailOrMobile }
        ]
      }).select('username email mobile');

      if (!foundUser) {
        throw new Error('User not found');
      }

      return foundUser;
    },

    pendingConnectionRequests: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const pendingUsernames = await getPendingRequests(user.username);
      const pendingUsers = await User.find({ 
        username: { $in: pendingUsernames } 
      }).select('username email mobile');
      
      return pendingUsers;
    },

    connections: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const connectedUsernames = await getUserConnections(user.username);
      const connectedUsers = await User.find({ 
        username: { $in: connectedUsernames } 
      }).select('username email mobile');
      
      return connectedUsers;
    }
  },

  Mutation: {
    register: async (_, { username, email, password, mobile, age, gender }) => {
      try {
        // Check if user already exists with email or mobile
        const existingUser = await User.findOne({
          $or: [{ email }, { mobile }]
        });
        
        if (existingUser) {
          if (existingUser.email === email) {
            throw new Error('Email already registered');
          }
          if (existingUser.mobile === mobile) {
            throw new Error('Mobile number already registered');
          }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Password hashed successfully');

        // Create new user
        const user = new User({
          username,
          email,
          password: hashedPassword,
          mobile,
          age,
          gender
        });

        await user.save();
        console.log('User registered successfully');

        // Create Neo4j node for the user
        await createUserNode(username);
        console.log('Neo4j node created for user');

        // Generate JWT token
        const token = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '1d' }
        );
        console.log('JWT token generated');

        // Return user without password
        const userWithoutPassword = {
          id: user._id,
          username: user.username,
          email: user.email,
          mobile: user.mobile,
          age: user.age,
          gender: user.gender
        };

        return {
          token,
          user: userWithoutPassword
        };
      } catch (error) {
        console.error('Registration error:', error);
        throw new Error(error.message);
      }
    },

    login: async (_, { emailOrMobile, password }) => {
      try {
        // Find user by email or mobile
        const user = await User.findOne({
          $or: [
            { email: emailOrMobile },
            { mobile: emailOrMobile }
          ]
        });

        if (!user) {
          throw new Error('User not found');
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          throw new Error('Invalid password');
        }
        console.log('Password verified successfully');

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '1d' }
        );
        console.log('JWT token generated');

        // Return user without password
        const userWithoutPassword = {
          id: user._id,
          username: user.username,
          email: user.email,
          mobile: user.mobile,
          age: user.age,
          gender: user.gender
        };

        return {
          token,
          user: userWithoutPassword
        };
      } catch (error) {
        console.error('Login error:', error);
        throw new Error(error.message);
      }
    },

    sendConnectionRequest: async (_, { targetUsername }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      // Check if target user exists
      const targetUser = await User.findOne({ username: targetUsername });
      if (!targetUser) throw new Error('Target user not found');

      // Prevent self-connection
      if (user.username === targetUsername) {
        throw new Error('Cannot connect with yourself');
      }

      // Create connection request in Neo4j
      await createConnectionRequest(user.username, targetUsername);
      
      return true;
    },

    acceptConnectionRequest: async (_, { fromUsername }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      // Check if request exists
      const pendingRequests = await getPendingRequests(user.username);
      if (!pendingRequests.includes(fromUsername)) {
        throw new Error('No pending request from this user');
      }

      // Accept the connection request
      await acceptConnectionRequest(fromUsername, user.username);
      
      return true;
    },

    rejectConnectionRequest: async (_, { fromUsername }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      // Check if request exists
      const pendingRequests = await getPendingRequests(user.username);
      if (!pendingRequests.includes(fromUsername)) {
        throw new Error('No pending request from this user');
      }

      // Delete the request
      await deleteConnectionRequest(fromUsername, user.username);
      
      return true;
    },

    removeConnection: async (_, { targetUsername }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      // Check if target user exists
      const targetUser = await User.findOne({ username: targetUsername });
      if (!targetUser) throw new Error('Target user not found');

      // Check if connection exists
      const connections = await getUserConnections(user.username);
      if (!connections.includes(targetUsername)) {
        throw new Error('No connection exists with this user');
      }

      // Remove the connection
      await removeConnection(user.username, targetUsername);
      
      return true;
    }
  }
};

export default resolvers;
