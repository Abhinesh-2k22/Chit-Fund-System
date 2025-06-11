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

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    searchUser(emailOrMobile: String!): User
    pendingConnectionRequests: [User!]!
    connections: [User!]!
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
      emailOrMobile: String!
      password: String!
    ): AuthPayload!

    sendConnectionRequest(targetUsername: String!): Boolean!
    acceptConnectionRequest(fromUsername: String!): Boolean!
    rejectConnectionRequest(fromUsername: String!): Boolean!
    removeConnection(targetUsername: String!): Boolean!
  }
`;

export default typeDefs;
