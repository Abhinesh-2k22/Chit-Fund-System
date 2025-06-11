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

// Close Neo4j driver connection
process.on('SIGINT', async () => {
  await driver.close();
  process.exit(0);
});

export default driver; 