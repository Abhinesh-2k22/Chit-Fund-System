import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import typeDefs from './graphql/schema.js';
import resolvers from './graphql/resolvers.js';

// Load environment variables
dotenv.config();
console.log('Environment variables loaded');

const app = express();
app.use(cookieParser());
console.log('Cookie parser middleware added');

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://studio.apollographql.com', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
}));
console.log('CORS middleware configured');

app.use(express.json());
console.log('JSON middleware added');

// MongoDB connection
console.log('Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if cannot connect to database
  });

// Context function for Apollo Server
const context = async ({ req, res }) => {
  // Get token from cookie or authorization header
  const authCookie = req.cookies ? req.cookies.authToken : null;
  const authHeader = req.headers.authorization || "";
  const token = authCookie || authHeader.replace("Bearer ", "");
  
  if (!token) {
    return { user: null, req, res };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = mongoose.model('User');
    const user = await User.findById(decoded.userId).select('-password');
    return { user, req, res };
  } catch (err) {
    return { user: null, req, res };
  }
};

// Create Apollo Server
console.log('Creating Apollo Server...');
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context,
  csrfPrevention: false,
  cors: {
    origin: ['http://localhost:3000', 'https://studio.apollographql.com', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie']
  }
});

// Start server
async function startServer() {
  try {
    console.log('Starting Apollo Server...');
    await server.start();
    console.log('Apollo Server started successfully');
    
    server.applyMiddleware({ 
      app,
      cors: false,
      path: '/graphql'
    });
    console.log('Apollo middleware applied');

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}/graphql`);
      console.log('Server is ready to accept connections');
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
