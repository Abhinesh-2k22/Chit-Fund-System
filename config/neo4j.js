import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

// Neo4j connection configuration
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

// Create a user node in Neo4j
export const createUserNode = async (username) => {
  const session = driver.session();
  try {
    await session.run(
      'CREATE (u:User {username: $username})',
      { username }
    );
    console.log(`Created Neo4j node for user: ${username}`);
  } catch (error) {
    console.error('Error creating Neo4j node:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Create a group node and owner relationship
export const createGroupNode = async (groupId, groupName, ownerUsername) => {
  const session = driver.session();
  try {
    await session.run(
      `CREATE (g:Group {id: $groupId, name: $groupName})
       WITH g
       MATCH (u:User {username: $ownerUsername})
       CREATE (u)-[:OWNS]->(g)
       CREATE (u)-[:PARTICIPATES_IN {joinedAt: datetime()}]->(g)`,
      { groupId, groupName, ownerUsername }
    );
    console.log(`Created Neo4j node for group: ${groupName}`);
  } catch (error) {
    console.error('Error creating group node:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Add participant to group
export const addGroupParticipant = async (groupId, username) => {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (u:User {username: $username})
       MATCH (g:Group {id: $groupId})
       CREATE (u)-[:PARTICIPATES_IN {joinedAt: datetime()}]->(g)`,
      { groupId, username }
    );
    console.log(`Added participant ${username} to group ${groupId}`);
  } catch (error) {
    console.error('Error adding group participant:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Remove participant from group
export const removeGroupParticipant = async (groupId, username) => {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (u:User {username: $username})-[r:PARTICIPATES_IN]->(g:Group {id: $groupId})
       DELETE r`,
      { groupId, username }
    );
    console.log(`Removed participant ${username} from group ${groupId}`);
  } catch (error) {
    console.error('Error removing group participant:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Get all groups a user participates in
export const getUserGroups = async (username) => {
  const session = driver.session();
  try {
    console.log('Fetching groups for user:', username);
    const result = await session.run(
      `MATCH (u:User {username: $username})
       MATCH (u)-[r:PARTICIPATES_IN]->(g:Group)
       RETURN g.id as groupId,
              g.name as groupName,
              r.joinedAt as joinedAt,
              r.wonMonth as wonMonth,
              r.wonAmount as wonAmount,
              r.wonAt as wonAt,
              r.nextPayment as nextPayment,
              r.totalPaid as totalPaid,
              r.remainingPayments as remainingPayments,
              r.role as role`,
      { username }
    );
    
    const groups = result.records.map(record => ({
      groupId: record.get('groupId'),
      groupName: record.get('groupName'),
      joinedAt: record.get('joinedAt'),
      wonMonth: record.get('wonMonth'),
      wonAmount: record.get('wonAmount'),
      wonAt: record.get('wonAt'),
      nextPayment: record.get('nextPayment'),
      totalPaid: record.get('totalPaid'),
      remainingPayments: record.get('remainingPayments'),
      role: record.get('role')
    }));

    console.log('Found groups in Neo4j:', groups);
    return groups;
  } catch (error) {
    console.error('Error getting user groups:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Get all participants in a group with their status
export const getGroupParticipants = async (groupId) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (g:Group {id: $groupId})<-[:PARTICIPATES_IN]-(u:User)
      RETURN u.username as username, u.joinedAt as joinedAt, u.wonMonth as wonMonth, u.wonAmount as wonAmount, u.wonAt as wonAt
      ORDER BY u.joinedAt
      `,
      { groupId }
    );
    return result.records.map(record => ({
      username: record.get('username'),
      joinedAt: record.get('joinedAt'),
      wonMonth: record.get('wonMonth'),
      wonAmount: record.get('wonAmount'),
      wonAt: record.get('wonAt')
    }));
  } finally {
    await session.close();
  }
};

// Check if user is group owner
export const isGroupOwner = async (groupId, username) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {username: $username})-[:OWNS]->(g:Group {id: $groupId})
       RETURN count(*) > 0 as isOwner`,
      { groupId, username }
    );
    return result.records[0].get('isOwner');
  } catch (error) {
    console.error('Error checking group ownership:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Check if user is group participant
export const isGroupParticipant = async (groupId, username) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {username: $username})-[:PARTICIPATES_IN]->(g:Group {id: $groupId})
       RETURN count(*) > 0 as isParticipant`,
      { groupId, username }
    );
    return result.records[0].get('isParticipant');
  } catch (error) {
    console.error('Error checking group participation:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Create a connection request
export const createConnectionRequest = async (fromUsername, toUsername) => {
  const session = driver.session();
  try {
    // Check if connection or request already exists
    const result = await session.run(
      `MATCH (from:User {username: $fromUsername})
       MATCH (to:User {username: $toUsername})
       OPTIONAL MATCH (from)-[r]->(to)
       RETURN r`,
      { fromUsername, toUsername }
    );

    if (result.records[0].get('r') !== null) {
      throw new Error('Connection or request already exists');
    }

    // Create the request
    await session.run(
      `MATCH (from:User {username: $fromUsername})
       MATCH (to:User {username: $toUsername})
       CREATE (from)-[:REQUESTED]->(to)`,
      { fromUsername, toUsername }
    );
    console.log(`Created connection request from ${fromUsername} to ${toUsername}`);
  } catch (error) {
    console.error('Error creating connection request:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Accept a connection request
export const acceptConnectionRequest = async (fromUsername, toUsername) => {
  const session = driver.session();
  try {
    // Delete the request and create bidirectional connection
    await session.run(
      `MATCH (from:User {username: $fromUsername})-[r:REQUESTED]->(to:User {username: $toUsername})
       DELETE r
       CREATE (from)-[:CONNECTED_TO]->(to)
       CREATE (to)-[:CONNECTED_TO]->(from)`,
      { fromUsername, toUsername }
    );
    console.log(`Connection request accepted between ${fromUsername} and ${toUsername}`);
  } catch (error) {
    console.error('Error accepting connection request:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Get user's pending connection requests
export const getPendingRequests = async (username) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (from:User)-[:REQUESTED]->(to:User {username: $username})
       RETURN from.username as username`,
      { username }
    );
    return result.records.map(record => record.get('username'));
  } catch (error) {
    console.error('Error getting pending requests:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Delete a connection request
export const deleteConnectionRequest = async (fromUsername, toUsername) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {username: $fromUsername})-[r:REQUESTED]->(t:User {username: $toUsername})
       DELETE r`,
      { fromUsername, toUsername }
    );
    if (result.summary.counters.relationshipsDeleted === 0) {
      throw new Error('No invitation found for this user');
    }
    console.log(`Deleted connection request from ${fromUsername} to ${toUsername}`);
  } catch (error) {
    console.error('Error deleting connection request:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Get user connections
export const getUserConnections = async (username) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {username: $username})-[:CONNECTED_TO]->(connected:User)
       RETURN connected.username as username`,
      { username }
    );
    return result.records.map(record => record.get('username'));
  } catch (error) {
    console.error('Error getting user connections:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Remove connection between users
export const removeConnection = async (fromUsername, toUsername) => {
  const session = driver.session();
  try {
    // Delete both directional connections
    await session.run(
      `MATCH (from:User {username: $fromUsername})-[r1:CONNECTED_TO]->(to:User {username: $toUsername})
       MATCH (to)-[r2:CONNECTED_TO]->(from)
       DELETE r1, r2`,
      { fromUsername, toUsername }
    );
    console.log(`Removed connection between ${fromUsername} and ${toUsername}`);
  } catch (error) {
    console.error('Error removing connection:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Create a group invitation
export const createGroupInvite = async (groupId, fromUsername, toUsername) => {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (u:User {username: $toUsername})
       MATCH (g:Group {id: $groupId})
       CREATE (u)-[:INVITED_TO {invitedAt: datetime(), invitedBy: $fromUsername}]->(g)`,
      { groupId, fromUsername, toUsername }
    );
    console.log(`Created group invite for ${toUsername} to group ${groupId}`);
  } catch (error) {
    console.error('Error creating group invite:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Get pending group invites for a user
export const getPendingGroupInvites = async (username) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {username: $username})-[invite:INVITED_TO]->(g:Group)
       RETURN g.id as groupId, 
              g.name as groupName, 
              invite.invitedBy as invitedBy,
              invite.invitedAt as invitedAt`,
      { username }
    );
    return result.records.map(record => ({
      groupId: record.get('groupId'),
      groupName: record.get('groupName'),
      invitedBy: record.get('invitedBy'),
      invitedAt: record.get('invitedAt')
    }));
  } catch (error) {
    console.error('Error getting pending group invites:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Accept group invite
export const acceptGroupInvite = async (groupId, username) => {
  const session = driver.session();
  try {
    // First check if the invitation exists
    const checkResult = await session.run(
      `MATCH (u:User {username: $username})-[invite:INVITED_TO]->(g:Group {id: $groupId})
       RETURN count(invite) as inviteCount`,
      { groupId, username }
    );

    const inviteCount = checkResult.records[0].get('inviteCount').toNumber();
    if (inviteCount === 0) {
      throw new Error('No invitation found for this group');
    }

    // If invitation exists, accept it
    await session.run(
      `MATCH (u:User {username: $username})-[invite:INVITED_TO]->(g:Group {id: $groupId})
       DELETE invite
       CREATE (u)-[:PARTICIPATES_IN {joinedAt: datetime()}]->(g)`,
      { groupId, username }
    );
    console.log(`User ${username} accepted invite to group ${groupId}`);
    return true;
  } catch (error) {
    console.error('Error accepting group invite:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Reject group invite
export const rejectGroupInvite = async (groupId, username) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {username: $username})-[r:INVITED_TO]->(g:Group {id: $groupId})
       DELETE r
       RETURN count(r) as deletedCount`,
      { groupId, username }
    );
    
    const deletedCount = result.records[0].get('deletedCount').toNumber();
    if (deletedCount === 0) {
      throw new Error('No invitation found to reject');
    }
    
    console.log(`Rejected group invite for ${username} to group ${groupId}`);
  } catch (error) {
    console.error('Error rejecting group invite:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Get all outgoing group invites for a specific group (initiated by the owner)
export const getGroupOutgoingInvitesNeo4j = async (groupId) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User)-[invite:INVITED_TO]->(g:Group {id: $groupId})
       RETURN u.username AS invitedUsername`,
      { groupId }
    );
    return result.records.map(record => record.get('invitedUsername'));
  } catch (error) {
    console.error('Error fetching outgoing group invites:', error);
    throw error;
  } finally {
    await session.close();
  }
};

export const getGroupPendingInvitesNeo4j = async (groupId) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User)-[:INVITED_TO]->(g:Group {id: $groupId})
       RETURN u.username AS invitedUsername`,
      { groupId }
    );
    return result.records.map(record => record.get('invitedUsername'));
  } catch (error) {
    console.error('Error fetching group pending invites:', error);
    throw error;
  } finally {
    await session.close();
  }
};

// Close Neo4j driver connection
process.on('SIGINT', async () => {
  await driver.close();
  process.exit(0);
});

export default driver; 