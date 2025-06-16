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
  removeGroupParticipant,
  getUserGroups,
  getGroupParticipants,
  isGroupOwner,
  isGroupParticipant,
  createGroupInvite,
  getPendingGroupInvites,
  acceptGroupInvite,
  rejectGroupInvite,
  deleteConnectionRequest,
  getGroupOutgoingInvitesNeo4j,
  getGroupPendingInvitesNeo4j
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
      
      // Fetch fresh user data from MongoDB
      const freshUser = await User.findById(user.id).select('-password');
      if (!freshUser) throw new Error('User not found');
      
      // Get balance from MySQL
      const [rows] = await pool.query('SELECT balance FROM users WHERE username = ?', [freshUser.username]);
      const balance = rows[0]?.balance || 0;
      
      return {
        id: freshUser._id,
        username: freshUser.username,
        email: freshUser.email,
        mobile: freshUser.mobile,
        age: freshUser.age,
        gender: freshUser.gender,
        lastLogin: freshUser.lastLogin ? freshUser.lastLogin.toISOString() : null,
        balance: balance,
        createdAt: freshUser.createdAt ? freshUser.createdAt.toISOString() : null
      };
    },

    userBalance: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      try {
        const [rows] = await pool.query('SELECT balance FROM users WHERE username = ?', [user.username]);
        return rows[0]?.balance || 0;
      } catch (error) {
        console.error('Error fetching user balance:', error);
        throw new Error('Failed to fetch user balance');
      }
    },

    searchUser: async (_, { emailOrMobile }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Create a regex pattern for partial matching
      const searchPattern = new RegExp(emailOrMobile, 'i');
      
      const foundUsers = await User.find({
        $or: [
          { email: searchPattern },
          { mobile: searchPattern },
          { username: searchPattern }
        ],
        // Exclude the current user from results
        _id: { $ne: user.id }
      }).select('username email mobile');

      if (!foundUsers || foundUsers.length === 0) {
        throw new Error('No users found');
      }

      return foundUsers;
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

    pendingGroupInvites: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      try {
        console.log('Fetching pending group invites for user:', user.username);
        
        // Get pending invites from Neo4j
        const pendingInvites = await getPendingGroupInvites(user.username);
        console.log('Neo4j pending invites:', pendingInvites);
        
        if (!pendingInvites || pendingInvites.length === 0) {
          console.log('No pending invites found');
          return [];
        }

        // Get group details from MongoDB
        const groupIds = pendingInvites.map(invite => invite.groupId);
        console.log('Fetching MongoDB groups with IDs:', groupIds);

        const groups = await Group.find({ 
          _id: { $in: groupIds } 
        });

        console.log('MongoDB groups:', groups);

        if (!groups || groups.length === 0) {
          console.log('No groups found in MongoDB');
          return [];
        }

        // Create a map of group details for quick lookup
        const groupMap = new Map(
          groups.map(g => [g._id.toString(), g])
        );

        // Combine Neo4j and MongoDB data
        const enrichedInvites = pendingInvites.map(invite => {
          const group = groupMap.get(invite.groupId);
          if (!group) {
            console.error('Group not found for invite:', invite);
            return null;
          }

          // Convert Neo4j DateTime to ISO string
          let invitedAt = null;
          if (invite.invitedAt) {
            try {
              // Handle Neo4j DateTime object with BigInt values
              if (typeof invite.invitedAt === 'object' && invite.invitedAt.year) {
                const date = new Date(
                  Number(invite.invitedAt.year),
                  Number(invite.invitedAt.month) - 1, // JavaScript months are 0-based
                  Number(invite.invitedAt.day),
                  Number(invite.invitedAt.hour),
                  Number(invite.invitedAt.minute),
                  Number(invite.invitedAt.second)
                );
                invitedAt = date.toISOString();
              } else {
                // If it's already a string or other format, use as is
                invitedAt = invite.invitedAt;
              }
            } catch (error) {
              console.error('Error converting date:', error);
              invitedAt = null;
            }
          }

          return {
            groupId: invite.groupId,
            groupName: group.name,
            invitedBy: invite.invitedBy,
            invitedAt: invitedAt
          };
        }).filter(invite => invite !== null);

        console.log('Final enriched invites:', enrichedInvites);
        return enrichedInvites;
      } catch (error) {
        console.error('Error fetching pending group invites:', error);
        throw new Error(error.message || 'Failed to fetch pending group invites');
      }
    },

    myGroups: async (_, { username }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      try {
        // Verify if the requesting user is authorized
        if (user.username !== username) {
          throw new Error('Not authorized to view these groups');
        }

        console.log('Fetching groups for user:', username);

        // Get all groups where user is a participant from Neo4j
        const userGroups = await getUserGroups(username);
        console.log('Neo4j user groups:', userGroups);
        
        if (!userGroups || userGroups.length === 0) {
          console.log('No groups found in Neo4j');
          return [];
        }

        // Get detailed group information from MongoDB
        const groupIds = userGroups.map(g => g.groupId);
        console.log('Fetching MongoDB groups with IDs:', groupIds);

        const groups = await Group.find({ 
          _id: { $in: groupIds } 
        });

        console.log('MongoDB groups:', groups);

        if (!groups || groups.length === 0) {
          console.log('No groups found in MongoDB');
          return [];
        }

        // Get owner details for all groups
        const ownerUsernames = [...new Set(groups.map(g => g.owner))];
        const owners = await User.find({ username: { $in: ownerUsernames } }).select('username email mobile');
        const ownerMap = new Map(owners.map(o => [o.username, o]));

        // Create a map of Neo4j group data for quick lookup
        const neo4jGroupMap = new Map(
          userGroups.map(g => [g.groupId, g])
        );

        // Combine Neo4j and MongoDB data
        const enrichedGroups = groups.map(group => {
          try {
            if (!group || !group._id) {
              console.error('Invalid group data:', group);
              return null;
            }

            const groupId = group._id.toString();
            const neo4jData = neo4jGroupMap.get(groupId);
            
            if (!neo4jData) {
              console.error('No Neo4j data found for group:', groupId);
              return null;
            }

            const owner = ownerMap.get(group.owner);
            if (!owner) {
              console.error('Owner not found for group:', groupId);
              return null;
            }

            // Determine role based on ownership
            const isOwner = group.owner === username;
            const role = isOwner ? 'owner' : (neo4jData.role || 'participant');

            console.log(`Processing group ${group.name}:`, {
              groupId,
              isOwner,
              role,
              neo4jData,
              owner: owner.username
            });

            // Create the enriched group object
            const enrichedGroup = {
              id: groupId,
              name: group.name || neo4jData.groupName || '',
              totalPoolAmount: group.totalPoolAmount || 0,
              totalMonths: group.totalMonths || 0,
              status: group.status || 'pending',
              shuffleDate: group.shuffleDate ? group.shuffleDate.toISOString() : null,
              createdAt: group.createdAt ? group.createdAt.toISOString() : new Date().toISOString(),
              currentmonth: group.currentmonth || 0,
              owner: {
                id: owner._id.toString(),
                username: owner.username,
                email: owner.email,
                mobile: owner.mobile
              },
              role: role,
              joinedAt: neo4jData.joinedAt ? new Date(neo4jData.joinedAt).toISOString() : new Date().toISOString(),
              wonMonth: neo4jData.wonMonth || null,
              wonAmount: neo4jData.wonAmount || null,
              wonAt: neo4jData.wonAt ? new Date(neo4jData.wonAt).toISOString() : null,
              nextPayment: neo4jData.nextPayment || 0,
              totalPaid: neo4jData.totalPaid || 0,
              remainingPayments: neo4jData.remainingPayments || group.totalMonths || 0
            };

            console.log('Enriched group:', enrichedGroup);
            return enrichedGroup;
          } catch (error) {
            console.error('Error processing group:', error);
            return null;
          }
        }).filter(group => group !== null);

        console.log('Final enriched groups:', enrichedGroups);
        return enrichedGroups;
      } catch (error) {
        console.error('Error fetching user groups:', error);
        throw new Error(error.message || 'Failed to fetch user groups');
      }
    },

    groupDetails: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const isParticipant = await isGroupParticipant(groupId, user.username);
      if (!isParticipant) throw new Error('Not authorized to view this group');
      
      const group = await Group.findById(groupId);
      if (!group) throw new Error('Group not found');

      // Get owner details from User model
      const owner = await User.findOne({ username: group.owner }).select('username email mobile');
      if (!owner) throw new Error('Group owner not found');
      
      return {
        id: group._id.toString(),
        name: group.name,
        totalPoolAmount: group.totalPoolAmount,
        totalMonths: group.totalMonths,
        status: group.status,
        shuffleDate: group.shuffleDate ? group.shuffleDate.toISOString() : null,
        createdAt: group.createdAt.toISOString(),
        currentmonth: group.currentmonth,
        owner: {
          id: owner._id.toString(),
          username: owner.username,
          email: owner.email,
          mobile: owner.mobile
        }
      };
    },

    groupParticipants: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const isParticipant = await isGroupParticipant(groupId, user.username);
      if (!isParticipant) throw new Error('Not authorized to view this group');
      
      const participants = await getGroupParticipants(groupId);

      // Format dates and ensure correct types
      return participants.map(p => {
        let joinedAtISO = new Date().toISOString(); // Default to current date if null
        if (p.joinedAt) {
          try {
            if (typeof p.joinedAt === 'object' && p.joinedAt.year) {
              const date = new Date(
                Number(p.joinedAt.year),
                Number(p.joinedAt.month) - 1, 
                Number(p.joinedAt.day),
                Number(p.joinedAt.hour),
                Number(p.joinedAt.minute),
                Number(p.joinedAt.second)
              );
              joinedAtISO = date.toISOString();
            } else {
              joinedAtISO = p.joinedAt;
            }
          } catch (error) {
            console.error('Error converting joinedAt date:', error);
            // Keep the default current date if conversion fails
          }
        }

        let wonAtISO = null;
        if (p.wonAt) {
          try {
            if (typeof p.wonAt === 'object' && p.wonAt.year) {
              const date = new Date(
                Number(p.wonAt.year),
                Number(p.wonAt.month) - 1,
                Number(p.wonAt.day),
                Number(p.wonAt.hour),
                Number(p.wonAt.minute),
                Number(p.wonAt.second)
              );
              wonAtISO = date.toISOString();
            } else {
              wonAtISO = p.wonAt;
            }
          } catch (error) {
            console.error('Error converting wonAt date:', error);
            wonAtISO = null;
          }
        }

        return {
          username: p.username,
          joinedAt: joinedAtISO,
          wonMonth: p.wonMonth || null,
          wonAmount: p.wonAmount || null,
          wonAt: wonAtISO,
        };
      });
    },

    getTransactions: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      try {
        const [transactions] = await pool.query(
          `SELECT * FROM transfer 
           WHERE from_field = ? OR to_field = ?
           ORDER BY time_stamp DESC`,
          [user.username, user.username]
        );

        return transactions.map(transaction => ({
          id: transaction.id,
          fromField: transaction.from_field,
          toField: transaction.to_field,
          amount: transaction.amount,
          description: transaction.description,
          timeStamp: transaction.time_stamp.toISOString()
        }));
      } catch (error) {
        console.error('Error fetching transactions:', error);
        throw new Error('Failed to fetch transactions');
      }
    },

    getGroupOutgoingInvites: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const isOwner = await isGroupOwner(groupId, user.username);
        if (!isOwner) throw new Error('Not authorized to view outgoing invites for this group');

        // Assuming getGroupOutgoingInvites exists in neo4j.js and returns usernames
        const outgoingInvites = await getGroupOutgoingInvitesNeo4j(groupId); 
        return outgoingInvites;
      } catch (error) {
        console.error('Error fetching outgoing invites:', error);
        throw new Error(error.message || 'Failed to fetch outgoing invites');
      }
    },

    groupPendingInvites: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      try {
        // Any participant of the group should be able to see pending invites
        const isParticipant = await isGroupParticipant(groupId, user.username);
        if (!isParticipant) throw new Error('Not authorized to view pending invites for this group');

        const pendingInvites = await getGroupPendingInvitesNeo4j(groupId);
        return pendingInvites;
      } catch (error) {
        console.error('Error fetching group pending invites:', error);
        throw new Error(error.message || 'Failed to fetch group pending invites');
      }
    },

    getCurrentBid: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      try {
        // Check if user is a participant in the group
        const isParticipant = await isGroupParticipant(groupId, user.username);
        if (!isParticipant) {
          throw new Error('Not authorized to view bids for this group');
        }

        // Get the group details to check pool amount and current month
        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error('Group not found');
        }

        // Get the lowest bid for the current month
        const [rows] = await pool.query(
          `SELECT 
            id, 
            group_id as groupId,
            bid_amount as bidAmount, 
            username, 
            created_at as createdAt,
            is_winner as isWinner,
            current_month as currentmonth
          FROM bids 
          WHERE group_id = ? 
          AND current_month = ?
          ORDER BY bid_amount ASC 
          LIMIT 1`,
          [groupId, group.currentmonth]
        );

        // If there's a bid, add the current month from the group
        if (rows[0]) {
          return {
            ...rows[0],
            currentmonth: group.currentmonth
          };
        }

        return null;
      } catch (error) {
        console.error('Error fetching current bid:', error);
        throw new Error('Failed to fetch current bid');
      }
    },

    getBidHistory: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      try {
        // Check if user is a participant in the group
        const isParticipant = await isGroupParticipant(groupId, user.username);
        if (!isParticipant) {
          throw new Error('Not authorized to view bids for this group');
        }

        // Get the group details to check pool amount
        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error('Group not found');
        }

        // Get all valid bids for the group (bids lower than pool amount)
        const [rows] = await pool.query(
          `SELECT 
            id, 
            group_id as groupId,
            bid_amount as bidAmount, 
            username, 
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as createdAt,
            is_winner as isWinner,
            current_month as currentmonth
          FROM bids 
          WHERE group_id = ? 
          AND bid_amount < ?
          ORDER BY bid_amount ASC`,
          [groupId, group.totalPoolAmount]
        );

        return rows;
      } catch (error) {
        console.error('Error fetching bid history:', error);
        throw new Error('Failed to fetch bid history');
      }
    },

    isWinner: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      try {
        // Check if user is a participant in the group
        const isParticipant = await isGroupParticipant(groupId, user.username);
        if (!isParticipant) {
          throw new Error('Not authorized to view bids for this group');
        }

        // Get all winning bids for the group
        const [rows] = await pool.query(
          `SELECT 
            id, 
            group_id as groupId,
            bid_amount as bidAmount, 
            username, 
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as createdAt,
            is_winner as isWinner,
            current_month as currentmonth
          FROM bids 
          WHERE group_id = ? 
          AND is_winner = 1
          ORDER BY current_month ASC`,
          [groupId]
        );

        return rows;
      } catch (error) {
        console.error('Error fetching winning bids:', error);
        throw new Error('Failed to fetch winning bids');
      }
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
        // Validate totalMonths
        if (totalMonths < 1 || totalMonths > 12) {
          throw new Error('Group duration must be between 1 and 12 months');
        }

        // Create group in MongoDB with username as owner
        const group = new Group({
          name,
          owner: user.username,
          totalPoolAmount,
          totalMonths,
          status: 'waiting',
          createdAt: new Date()
        });

        const savedGroup = await group.save();
        if (!savedGroup || !savedGroup._id) {
          throw new Error('Failed to create group');
        }

        // Create group node and relationships in Neo4j
        await createGroupNode(savedGroup._id.toString(), name, user.username);

        // Get owner details for response
        const owner = await User.findOne({ username: user.username }).select('username email mobile');
        
        return {
          id: savedGroup._id.toString(),
          name: savedGroup.name,
          totalPoolAmount: savedGroup.totalPoolAmount,
          totalMonths: savedGroup.totalMonths,
          status: savedGroup.status,
          createdAt: savedGroup.createdAt.toISOString(),
          owner: {
            id: owner._id.toString(),
            username: owner.username,
            email: owner.email,
            mobile: owner.mobile
          }
        };
      } catch (error) {
        console.error('Error creating group:', error);
        throw new Error(error.message || 'Failed to create group');
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

    updateGroupDetails: async (_, { groupId, name, totalPoolAmount, totalMonths }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const group = await Group.findById(groupId);
        if (!group) throw new Error('Group not found');

        const isOwner = await isGroupOwner(groupId, user.username);
        if (!isOwner) throw new Error('Only group owner can update group details');

        if (group.status !== 'waiting') {
          throw new Error('Group details can only be updated when the group is in waiting status');
        }

        // Update fields if provided
        if (name !== undefined) {
          group.name = name;
        }
        if (totalPoolAmount !== undefined) {
          group.totalPoolAmount = totalPoolAmount;
        }
        if (totalMonths !== undefined) {
          if (totalMonths < 1 || totalMonths > 12) {
            throw new Error('Group duration must be between 1 and 12 months');
          }
          group.totalMonths = totalMonths;
        }

        const updatedGroup = await group.save();

        // Get owner details for response
        const owner = await User.findOne({ username: updatedGroup.owner }).select('username email mobile');

        return {
          id: updatedGroup._id.toString(),
          name: updatedGroup.name,
          totalPoolAmount: updatedGroup.totalPoolAmount,
          totalMonths: updatedGroup.totalMonths,
          status: updatedGroup.status,
          createdAt: updatedGroup.createdAt.toISOString(),
          owner: {
            id: owner._id.toString(),
            username: owner.username,
            email: owner.email,
            mobile: owner.mobile
          }
        };
      } catch (error) {
        console.error('Error updating group details:', error);
        throw new Error(error.message || 'Failed to update group details');
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
        // First check if the group exists
        const group = await Group.findById(groupId);
        if (!group) throw new Error('Group not found');

        // Check if there is actually a pending invite
        const pendingInvites = await getPendingGroupInvites(user.username);
        const hasPendingInvite = pendingInvites.some(invite => invite.groupId === groupId);
        if (!hasPendingInvite) {
          throw new Error('No pending invitation found for this group');
        }

        // Reject invitation in Neo4j
        await rejectGroupInvite(groupId, user.username);
        return true;
      } catch (error) {
        console.error('Error rejecting group invite:', error);
        // Return false instead of throwing error for user-friendly handling
        if (error.message.includes('No invitation found') || 
            error.message.includes('No pending invitation')) {
          return false;
        }
        throw error;
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

        // Calculate shuffle date (30 days from now)
        const shuffleDate = new Date();
        shuffleDate.setDate(shuffleDate.getDate() + 30);

        // Update group fields
        group.status = 'started';
        group.shuffleDate = shuffleDate;
        group.currentmonth = 1; // Using the correct field name from schema
        
        // Save the updated group
        const updatedGroup = await group.save();
        console.log('Group started with currentmonth:', updatedGroup.currentmonth); // Add logging to verify

        return true;
      } catch (error) {
        console.error('Error starting group:', error); // Add error logging
        throw new Error(error.message);
      }
    },

    leaveGroup: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      try {
        // Check if group exists
        const group = await Group.findById(groupId);
        if (!group) throw new Error('Group not found');

        // Check if user is a participant
        const isParticipant = await isGroupParticipant(groupId, user.username);
        if (!isParticipant) throw new Error('You are not a participant in this group');

        // Check if user is the owner
        const isOwner = await isGroupOwner(groupId, user.username);
        if (isOwner) throw new Error('Group owner cannot leave the group');

        // Check if group has started
        if (group.status === 'started') {
          throw new Error('Cannot leave a group that has already started');
        }

        // Remove participant from Neo4j
        await removeGroupParticipant(groupId, user.username);

        return true;
      } catch (error) {
        console.error('Error leaving group:', error);
        throw new Error(error.message);
      }
    },

    addFund: async (_, { amount }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      try {
        // Start a transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
          // Update user's balance
          const [updateResult] = await connection.query(
            'UPDATE users SET balance = balance + ? WHERE username = ?',
            [amount, user.username]
          );

          if (updateResult.affectedRows === 0) {
            throw new Error('User not found');
          }

          // Add transfer record
          const [transferResult] = await connection.query(
            'INSERT INTO transfer (from_field, to_field, amount, description, time_stamp) VALUES (?, ?, ?, ?, NOW())',
            ['bank', user.username, amount, `${amount} added`]
          );

          // Commit the transaction
          await connection.commit();
          
          // Get updated balance
          const [balanceResult] = await connection.query(
            'SELECT balance FROM users WHERE username = ?',
            [user.username]
          );

          return {
            success: true,
            newBalance: balanceResult[0].balance
          };
        } catch (error) {
          // Rollback in case of error
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error('Error adding funds:', error);
        throw new Error(error.message || 'Failed to add funds');
      }
    },

    placeBid: async (_, { groupId, bidAmount }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      try {
        // Check if user is a participant in the group
        const isParticipant = await isGroupParticipant(groupId, user.username);
        if (!isParticipant) {
          throw new Error('Not authorized to place bids in this group');
        }

        // Get the group details to check pool amount
        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error('Group not found');
        }

        // Check if user is already a winner
        const [winningBids] = await pool.query(
          'SELECT username FROM bids WHERE group_id = ? AND is_winner = 1 AND username = ?',
          [groupId, user.username]
        );

        if (winningBids.length > 0) {
          throw new Error('You have already won a bid in this group and cannot place more bids');
        }

        // Get the current lowest bid for the current month
        const [currentBidRows] = await pool.query(
          'SELECT bid_amount FROM bids WHERE group_id = ? AND current_month = ? ORDER BY bid_amount ASC LIMIT 1',
          [groupId, group.currentmonth]
        );
        
        // If there's no current bid for this month, use the pool amount as the limit
        const currentLowestBid = currentBidRows.length > 0 ? currentBidRows[0].bid_amount : group.totalPoolAmount;

        // Validate bid amount
        if (bidAmount <= 0) {
          throw new Error('Bid amount must be greater than 0');
        }
        if (bidAmount >= currentLowestBid) {
          throw new Error(`Your bid must be lower than the current lowest bid (₹${currentLowestBid})`);
        }
        if (bidAmount >= group.totalPoolAmount) {
          throw new Error(`Your bid must be lower than the pool amount of ₹${group.totalPoolAmount}`);
        }

        // Start a transaction to ensure data consistency
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
          // Insert the new bid with current month
          const [result] = await connection.query(
            'INSERT INTO bids (group_id, username, bid_amount, current_month) VALUES (?, ?, ?, ?)',
            [groupId, user.username, bidAmount, group.currentmonth]
          );

          // Get the inserted bid
          const [newBid] = await connection.query(
            'SELECT id, bid_amount as bidAmount, username, DATE_FORMAT(created_at, "%Y-%m-%d %H:%i:%s") as createdAt, current_month as currentmonth FROM bids WHERE id = ?',
            [result.insertId]
          );

          await connection.commit();
          return newBid[0];
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error('Error placing bid:', error);
        throw new Error(error.message || 'Failed to place bid');
      }
    },

    selectWinner: async (_, { groupId }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      try {
        console.log('Starting selectWinner mutation for group:', groupId);
        
        // Check if user is a participant in the group
        const isParticipant = await isGroupParticipant(groupId, user.username);
        if (!isParticipant) {
          throw new Error('Not authorized to select winner for this group');
        }

        // Get the group details
        const group = await Group.findById(groupId);
        if (!group) {
          throw new Error('Group not found');
        }

        console.log('Current group state:', {
          status: group.status,
          currentmonth: group.currentmonth,
          totalMonths: group.totalMonths,
          shuffleDate: group.shuffleDate
        });

        // Check if group is in started status
        if (group.status !== 'started') {
          throw new Error('Group is not in started status');
        }

        // Check if current month is less than or equal to total months
        if (group.currentmonth >= group.totalMonths) {
          console.log('Group has reached its end, marking as completed');
          group.status = 'completed';
          await group.save();
          return true;
        }

        // Get all winners so far
        const winners = await resolvers.Query.isWinner(null, { groupId }, { user });
        console.log('Current winners:', winners);

        // Get all participants
        const participants = await getGroupParticipants(groupId);
        console.log('All participants:', participants);

        // Get the current lowest bid using existing query
        const currentBid = await resolvers.Query.getCurrentBid(null, { groupId }, { user });
        console.log('Current lowest bid:', currentBid);

        // Start a transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
          let winnerSelected = false;

          // If there's a current bid
          if (currentBid) {
            // If current bid equals pool amount, select random non-winner
            if (currentBid.bidAmount === group.totalPoolAmount) {
              console.log('Lowest bid equals pool amount, selecting random non-winner');
              
              // Filter out winners from participants
              const nonWinners = participants.filter(p => 
                !winners.some(w => w.username === p.username)
              );
              
              if (nonWinners.length > 0) {
                // Select random non-winner
                const randomIndex = Math.floor(Math.random() * nonWinners.length);
                const selectedWinner = nonWinners[randomIndex];
                console.log('Selected random winner:', selectedWinner);

                // Insert new bid for random winner
                const [insertResult] = await connection.query(
                  `INSERT INTO bids (group_id, username, bid_amount, current_month, is_winner) 
                   VALUES (?, ?, ?, ?, 1)`,
                  [groupId, selectedWinner.username, group.totalPoolAmount, group.currentmonth]
                );
                console.log('Inserted bid for random winner:', insertResult);
                winnerSelected = true;
              }
            } else {
              // Normal case: update existing bid as winner
              console.log('Updating winning bid for bid ID:', currentBid.id);
              const [updateResult] = await connection.query(
                'UPDATE bids SET is_winner = 1 WHERE id = ?',
                [currentBid.id]
              );
              console.log('Bid update result:', updateResult);
              winnerSelected = true;
            }
          } else {
            // No bids exist, select random non-winner
            console.log('No bids exist, selecting random non-winner');
            
            // Filter out winners from participants
            const nonWinners = participants.filter(p => 
              !winners.some(w => w.username === p.username)
            );
            
            if (nonWinners.length > 0) {
              // Select random non-winner
              const randomIndex = Math.floor(Math.random() * nonWinners.length);
              const selectedWinner = nonWinners[randomIndex];
              console.log('Selected random winner:', selectedWinner);

              // Insert new bid for random winner
              const [insertResult] = await connection.query(
                `INSERT INTO bids (group_id, username, bid_amount, current_month, is_winner) 
                 VALUES (?, ?, ?, ?, 1)`,
                [groupId, selectedWinner.username, group.totalPoolAmount, group.currentmonth]
              );
              console.log('Inserted bid for random winner:', insertResult);
              winnerSelected = true;
            }
          }

          // Only proceed with month increment and shuffle date update if a winner was selected
          if (winnerSelected) {
            // Increment current month
            const oldMonth = group.currentmonth;
            group.currentmonth += 1;
            console.log('Incrementing month from', oldMonth, 'to', group.currentmonth);

            // If we haven't reached the end, update shuffle date
            if (group.currentmonth <= group.totalMonths) {
              // Calculate new shuffle date (30 days from now)
              const oldShuffleDate = group.shuffleDate;
              const newShuffleDate = new Date();
              newShuffleDate.setDate(newShuffleDate.getDate() + 30);
              group.shuffleDate = newShuffleDate;
              console.log('Updating shuffle date from', oldShuffleDate, 'to', newShuffleDate);
            } else {
              // If we've reached the end, mark group as completed
              console.log('Group has reached its end, marking as completed');
              group.status = 'completed';
            }

            // Save group updates
            console.log('Saving group updates...');
            const savedGroup = await group.save();
            console.log('Group saved successfully:', {
              currentmonth: savedGroup.currentmonth,
              shuffleDate: savedGroup.shuffleDate,
              status: savedGroup.status
            });
          }

          // Commit transaction
          await connection.commit();
          console.log('Transaction committed successfully');
          return true;
        } catch (error) {
          // Rollback in case of error
          console.error('Error in transaction, rolling back:', error);
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error('Error in selectWinner mutation:', error);
        throw new Error(error.message || 'Failed to select winner');
      }
    }
  }
};

export default resolvers;
