import mongoose from "mongoose";

// Email validation regex
const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

// Mobile validation regex (10 digits)
const mobileRegex = /^[0-9]{10}$/;

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    validate: {
      validator: function(v) {
        return emailRegex.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  password: { 
    type: String, 
    required: true 
  },
  mobile: { 
    type: String, 
    required: true, 
    unique: true,
    validate: {
      validator: function(v) {
        return mobileRegex.test(v);
      },
      message: props => `${props.value} is not a valid 10-digit mobile number!`
    }
  },
  age: { 
    type: Number
  },
  gender: { 
    type: String,
    enum: ['male', 'female', 'other']
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
});

export default mongoose.model("User", UserSchema); 