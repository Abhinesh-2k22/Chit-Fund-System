import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Group from '../models/Group.js';
import { 
  createUserNode, 
  createConnectionRequest, 
  acceptConnectionRequest,
  getPendingRequests,
  getUserConnections,
  removeConnection,
  createGroupNode,
  addGroupParticipant,
  removeGroupParticipant,
  getUserGroups,
  getGroupParticipants,
  getGroupWinners,
  isGroupOwner,
  isGroupParticipant,
  recordWinner,
  createGroupInvite,
  getPendingGroupInvites,
  acceptGroupInvite,
  rejectGroupInvite
} from '../config/neo4j.js';
import { initializeMySQL } from '../config/mysql.js';
import pool from '../config/mysql.js';

dotenv.config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Initialize MySQL and create tables
    initializeMySQL();
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
    },

    // Group queries
    myGroups: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const groups = await getUserGroups(user.username);
      return Group.find({ _id: { $in: groups.map(g => g.groupId) } });
    },

    groupDetails: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const isParticipant = await isGroupParticipant(groupId, user.username);
      if (!isParticipant) throw new Error('Not authorized to view this group');
      
      const group = await Group.findById(groupId);
      if (!group) throw new Error('Group not found');

      // Get owner details from User model
      const owner = await User.findOne({ username: group.owner }).select('username email mobile');
      return {
        ...group.toObject(),
        owner
      };
    },

    groupParticipants: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const isParticipant = await isGroupParticipant(groupId, user.username);
      if (!isParticipant) throw new Error('Not authorized to view this group');
      
      return getGroupParticipants(groupId);
    },

    groupWinners: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const isParticipant = await isGroupParticipant(groupId, user.username);
      if (!isParticipant) throw new Error('Not authorized to view this group');
      
      return getGroupWinners(groupId);
    }
  },

  Mutation: {
    register: async (_, { username, email, password, mobile, age, gender }) => {
      try {
        // Check if username conflicts with any existing email or mobile
        const existingUserWithUsernameConflict = await User.findOne({
          $or: [
            { email: username },
            { mobile: username }
          ]
        });
        
        if (existingUserWithUsernameConflict) {
          throw new Error('Username cannot be the same as another user\'s email or mobile number');
        }

        // Check if email or mobile conflicts with any existing username
        const existingUserWithEmailMobileConflict = await User.findOne({
          $or: [
            { username: email },
            { username: mobile }
          ]
        });

        if (existingUserWithEmailMobileConflict) {
          throw new Error('Email or mobile number cannot be the same as another user\'s username');
        }

        // Check if user already exists with email or mobile
        const existingUser = await User.findOne({
          $or: [
            { email },
            { mobile },
            { username }
          ]
        });
        
        if (existingUser) {
          if (existingUser.username === username) {
            throw new Error('Username already taken');
          }
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

        // Add user to MySQL users table
        await pool.query('INSERT INTO users (username, balance) VALUES (?, ?)', [username, 0]);
        console.log('User added to MySQL users table');

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

    login: async (_, { usernameOrEmailOrMobile, password }) => {
      try {
        // Find user by username, email or mobile
        const user = await User.findOne({
          $or: [
            { username: usernameOrEmailOrMobile },
            { email: usernameOrEmailOrMobile },
            { mobile: usernameOrEmailOrMobile }
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
    },

    // Group mutations
    createGroup: async (_, { name, totalPoolAmount, totalMonths }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      try {
        // Create group in MongoDB with username as owner
        const group = new Group({
          name,
          owner: user.username,
          totalPoolAmount,
          totalMonths
        });

        await group.save();

        // Create group node and relationships in Neo4j
        await createGroupNode(group._id.toString(), name, user.username);

        // Get owner details for response
        const owner = await User.findOne({ username: user.username }).select('username email mobile');
        return {
          ...group.toObject(),
          owner
        };
      } catch (error) {
        throw new Error(error.message);
      }
    },

    inviteToGroup: async (_, { groupId, username }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const isOwner = await isGroupOwner(groupId, user.username);
        if (!isOwner) throw new Error('Only group owner can invite participants');

        const group = await Group.findById(groupId);
        if (!group) throw new Error('Group not found');
        if (group.status === 'started') throw new Error('Cannot invite to a started group');

        // Check if user is already a participant
        const isParticipant = await isGroupParticipant(groupId, username);
        if (isParticipant) {
          throw new Error('User is already a participant in this group');
        }

        // Check if user already has a pending invitation
        const pendingInvites = await getPendingGroupInvites(username);
        const hasPendingInvite = pendingInvites.some(invite => invite.groupId === groupId);
        if (hasPendingInvite) {
          throw new Error('User already has a pending invitation to this group');
        }

        // Create invitation in Neo4j
        await createGroupInvite(groupId, user.username, username);
        return true;
      } catch (error) {
        throw new Error(error.message);
      }
    },

    acceptGroupInvite: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const group = await Group.findById(groupId);
        if (!group) throw new Error('Group not found');
        if (group.status === 'started') throw new Error('Cannot join a started group');

        // Accept invitation in Neo4j
        await acceptGroupInvite(groupId, user.username);
        return true;
      } catch (error) {
        // If the error is from Neo4j about no invitation, return false
        if (error.message === 'No invitation found for this group') {
          return false;
        }
        // For other errors, throw them
        throw new Error(error.message);
      }
    },

    rejectGroupInvite: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const group = await Group.findById(groupId);
        if (!group) throw new Error('Group not found');

        // Reject invitation in Neo4j
        await rejectGroupInvite(groupId, user.username);
        return true;
      } catch (error) {
        throw new Error(error.message);
      }
    },

    startGroup: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const isOwner = await isGroupOwner(groupId, user.username);
        if (!isOwner) throw new Error('Only group owner can start the group');

        const group = await Group.findById(groupId);
        if (!group) throw new Error('Group not found');
        if (group.status === 'started') throw new Error('Group is already started');

        // Check if group can be started
        const canStart = await group.canStart();
        if (!canStart) throw new Error('Cannot start group: insufficient participants');

        group.status = 'started';
        group.shuffleDate = new Date();
        await group.save();

        return true;
      } catch (error) {
        throw new Error(error.message);
      }
    },

    recordWinner: async (_, { groupId, username, month, amount }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const isOwner = await isGroupOwner(groupId, user.username);
        if (!isOwner) throw new Error('Only group owner can record winners');

        const group = await Group.findById(groupId);
        if (!group) throw new Error('Group not found');
        if (group.status !== 'started') throw new Error('Group is not started');

        // Record winner in Neo4j
        await recordWinner(groupId, username, month, amount);

        return true;
      } catch (error) {
        throw new Error(error.message);
      }
    }
  }
};

export default resolvers;
