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
    balance: Float
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
    currentMonth: Int
    # User-specific group information
    role: String!
    joinedAt: String!
    wonMonth: Int
    wonAmount: Float
    wonAt: String
    nextPayment: Float!
    totalPaid: Float!
    remainingPayments: Int!
    currentBid: Bid
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
    searchUser(emailOrMobile: String!): [User!]!
    pendingConnectionRequests: [User!]!
    connections: [User!]!
    pendingGroupInvites: [GroupInvite!]!
    userBalance: Float!
    getTransactions: [Transaction!]!
    
    # Group queries
    myGroups(username: String!): [Group!]!
    groupDetails(groupId: ID!): Group
    groupParticipants(groupId: ID!): [GroupParticipant!]!
    groupWinners(groupId: ID!): [GroupWinner!]!
    getGroupOutgoingInvites(groupId: ID!): [String!]!
    groupPendingInvites(groupId: ID!): [String!]!
    
    # Bidding queries
    getCurrentBid(groupId: ID!): Bid
    getBidHistory(groupId: ID!): [Bid!]!
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
      totalMonths: Int! # Maximum 12 months
    ): Group!

    inviteToGroup(
      groupId: ID!
      username: String!
    ): Boolean!

    updateGroupDetails(
      groupId: ID!
      name: String
      totalPoolAmount: Float
      totalMonths: Int
    ): Group!

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

    leaveGroup(
      groupId: ID!
    ): Boolean!

    # Fund mutations
    addFund(amount: Int!): AddFundResponse!

    # Bidding mutations
    placeBid(
      groupId: ID!
      bidAmount: Float!
    ): Bid!

    selectWinner(
      groupId: ID!
      bidId: ID!
    ): Boolean!
  }

  type GroupInvite {
    groupId: ID!
    groupName: String!
    invitedBy: String!
    invitedAt: String!
  }

  type AddFundResponse {
    success: Boolean!
    newBalance: Float!
  }

  type Transaction {
    id: ID!
    fromField: String!
    toField: String!
    amount: Float!
    description: String!
    timeStamp: String!
  }

  type Bid {
    id: ID!
    groupId: ID!
    username: String!
    bidAmount: Float!
    createdAt: String!
    isWinner: Boolean!
  }
`;

export default typeDefs;
