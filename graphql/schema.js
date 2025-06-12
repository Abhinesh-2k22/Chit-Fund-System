import { gql } from 'apollo-server-express';

const typeDefs = gql`
  type User {
    id: ID!
    username: String!
    email: String!
    mobile: String!
    age: Int
    gender: String
    lastLogin: String
  }

  type Group {
    id: ID!
    name: String!
    owner: User!
    totalPoolAmount: Float!
    totalMonths: Int!
    shuffleDate: String
    status: String!
    createdAt: String!
  }

  type GroupParticipant {
    username: String!
    joinedAt: String!
    wonMonth: Int
    wonAmount: Float
    wonAt: String
  }

  type GroupWinner {
    username: String!
    month: Int!
    amount: Float!
    wonAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    searchUser(emailOrMobile: String!): User
    pendingConnectionRequests: [User!]!
    connections: [User!]!
    
    # Group queries
    myGroups: [Group!]!
    groupDetails(groupId: ID!): Group
    groupParticipants(groupId: ID!): [GroupParticipant!]!
    groupWinners(groupId: ID!): [GroupWinner!]!
  }

  type Mutation {
    register(
      username: String!
      email: String!
      password: String!
      mobile: String!
      age: Int
      gender: String
    ): AuthPayload!

    login(
      usernameOrEmailOrMobile: String!
      password: String!
    ): AuthPayload!

    sendConnectionRequest(targetUsername: String!): Boolean!
    acceptConnectionRequest(fromUsername: String!): Boolean!
    rejectConnectionRequest(fromUsername: String!): Boolean!
    removeConnection(targetUsername: String!): Boolean!

    # Group mutations
    createGroup(
      name: String!
      totalPoolAmount: Float!
      totalMonths: Int!
    ): Group!

    inviteToGroup(
      groupId: ID!
      username: String!
    ): Boolean!

    acceptGroupInvite(
      groupId: ID!
    ): Boolean!

    rejectGroupInvite(
      groupId: ID!
    ): Boolean!

    startGroup(
      groupId: ID!
    ): Boolean!

    recordWinner(
      groupId: ID!
      username: String!
      month: Int!
      amount: Float!
    ): Boolean!
  }
`;

export default typeDefs;
