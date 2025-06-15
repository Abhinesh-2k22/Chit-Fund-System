import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  owner: {
    type: String,
    required: true,
    ref: 'User'
  },
  totalPoolAmount: {
    type: Number,
    required: true,
    min: 1000
  },
  totalMonths: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  status: {
    type: String,
    required: true,
    enum: ['waiting', 'started', 'completed'],
    default: 'waiting'
  },
  shuffleDate: {
    type: Date
  },
  startDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  currentmonth:{
    type:Number,
    default: 0
  }
});

// Method to check if group can be started
groupSchema.methods.canStart = async function() {
  const { getGroupParticipants } = await import('../config/neo4j.js');
  const participants = await getGroupParticipants(this._id.toString());
  return participants.length === this.totalMonths;
};

// Method to add a participant
groupSchema.methods.addParticipant = async function(userId) {
  if (this.status === 'started') {
    throw new Error('Cannot add participants to a started group');
  }
  if (this.participants.length >= this.totalMonths) {
    throw new Error('Group is already full');
  }
  if (this.participants.includes(userId)) {
    throw new Error('User is already a participant');
  }
  this.participants.push(userId);
  return this.save();
};

// Method to remove a participant
groupSchema.methods.removeParticipant = async function(userId) {
  if (this.status === 'started') {
    throw new Error('Cannot remove participants from a started group');
  }
  if (userId.toString() === this.owner.toString()) {
    throw new Error('Cannot remove the owner from the group');
  }
  this.participants = this.participants.filter(
    participant => participant.toString() !== userId.toString()
  );
  return this.save();
};

// Method to add a winner
groupSchema.methods.addWinner = async function(userId, month, amount) {
  if (this.status !== 'started') {
    throw new Error('Cannot add winners to a non-started group');
  }
  if (!this.participants.includes(userId)) {
    throw new Error('Winner must be a participant in the group');
  }
  this.winners.push({
    winner: userId,
    month,
    amount,
    date: new Date()
  });
  return this.save();
};

// Static method to find groups by participant
groupSchema.statics.findByParticipant = function(userId) {
  return this.find({ participants: userId })
    .populate('owner', 'username email mobile')
    .populate('participants', 'username email mobile')
    .populate('winners.winner', 'username email mobile');
};

const Group = mongoose.model('Group', groupSchema);

export default Group; 