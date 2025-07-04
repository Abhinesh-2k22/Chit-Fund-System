import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, gql } from '@apollo/client';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const GET_GROUP_DETAILS = gql`
  query GetGroupDetails($groupId: ID!) {
    groupDetails(groupId: $groupId) {
      id
      name
      totalPoolAmount
      totalMonths
      status
      shuffleDate
      currentmonth
      owner {
        username
      }
    }
  }
`;

const GET_CURRENT_BID = gql`
  query GetCurrentBid($groupId: ID!) {
    getCurrentBid(groupId: $groupId) {
      id
      bidAmount
      username
      createdAt
    }
  }
`;

const GET_BID_HISTORY = gql`
  query GetBidHistory($groupId: ID!) {
    getBidHistory(groupId: $groupId) {
      id
      bidAmount
      username
      createdAt
      isWinner
      currentmonth
    }
  }
`;

const GET_WINNING_BIDS = gql`
  query GetWinningBids($groupId: ID!) {
    isWinner(groupId: $groupId) {
      id
      username
      bidAmount
      currentmonth
    }
  }
`;

const GET_SHOULD_SELECT_WINNER = gql`
  query ShouldSelectWinner($groupId: ID!) {
    shouldSelectWinner(groupId: $groupId)
  }
`;

const PLACE_BID = gql`
  mutation PlaceBid($groupId: ID!, $bidAmount: Float!) {
    placeBid(groupId: $groupId, bidAmount: $bidAmount) {
      id
      bidAmount
      username
      createdAt
    }
  }
`;

const SELECT_WINNER = gql`
  mutation SelectWinner($groupId: ID!) {
    selectWinner(groupId: $groupId)
  }
`;

const Bidding = ({ groupId }) => {
  const [bidAmount, setBidAmount] = useState('');
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const { user } = useAuth();
  const hasSelectedWinnerRef = useRef(false);

  const { data: groupData, loading: groupLoading } = useQuery(GET_GROUP_DETAILS, {
    variables: { groupId },
    pollInterval: 2000,
    fetchPolicy: 'network-only'
  });

  const { data: winningBidsData } = useQuery(GET_WINNING_BIDS, {
    variables: { groupId },
    skip: groupData?.groupDetails?.status !== 'started'
  });

  const { data: currentBidData, loading: currentBidLoading, refetch: refetchCurrentBid } = useQuery(GET_CURRENT_BID, {
    variables: { groupId },
    skip: groupData?.groupDetails?.status !== 'started',
    pollInterval: 2000,
    fetchPolicy: 'network-only'
  });

  const { data: bidHistoryData, loading: bidHistoryLoading, refetch: refetchBidHistory } = useQuery(GET_BID_HISTORY, {
    variables: { groupId },
    skip: groupData?.groupDetails?.status !== 'started',
    pollInterval: 2000,
    fetchPolicy: 'network-only'
  });

  const { data: shouldSelectWinnerData, loading: shouldSelectWinnerLoading } = useQuery(GET_SHOULD_SELECT_WINNER, {
    variables: { groupId },
    pollInterval: 2000,
    skip: groupData?.groupDetails?.status !== 'started'
  });

  const [placeBid] = useMutation(PLACE_BID, {
    onCompleted: () => {
      setBidAmount('');
      setError('');
      refetchCurrentBid();
      refetchBidHistory();
      if (socket) {
        socket.emit('newBid', groupId);
      }
    },
    onError: (error) => {
      setError(error.message);
    }
  });

  const [selectWinner] = useMutation(SELECT_WINNER, {
    onCompleted: () => {
      console.log('Winner selected successfully');
      refetchCurrentBid();
      refetchBidHistory();
    },
    onError: (error) => {
      console.error('Error selecting winner:', error);
      setError(error.message);
    }
  });

  // Effect to trigger winner selection when it's time
  useEffect(() => {
    if (shouldSelectWinnerData?.shouldSelectWinner && !hasSelectedWinnerRef.current) {
      hasSelectedWinnerRef.current = true;
      selectWinner({
        variables: { groupId }
      }).catch(error => {
        console.error('Failed to select winner:', error);
        hasSelectedWinnerRef.current = false;
      });
    }
  }, [shouldSelectWinnerData, groupId, selectWinner]);

  // Effect to calculate and display countdown
  useEffect(() => {
    if (groupData?.groupDetails?.shuffleDate) {
      const calculateTimeLeft = () => {
        const now = new Date().getTime();
        const shuffleTime = new Date(groupData.groupDetails.shuffleDate).getTime();
        const difference = shuffleTime - now;

        if (difference <= 0) {
          setTimeLeft(null);
          return;
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      };

      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 1000);

      return () => {
        clearInterval(timer);
      };
    }
  }, [groupData?.groupDetails?.shuffleDate]);

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io('http://localhost:4000', {
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      newSocket.emit('joinGroup', groupId);
    });

    newSocket.on('newBid', () => {
      refetchCurrentBid();
      refetchBidHistory();
    });

    newSocket.on('winnerSelected', () => {
      refetchCurrentBid();
      refetchBidHistory();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [groupId]);

  // Check if current user is a winner
  const isWinner = winningBidsData?.isWinner?.some(
    bid => bid.username === user?.username
  );

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    if (!bidAmount || isNaN(bidAmount) || bidAmount <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    try {
      await placeBid({
        variables: {
          groupId,
          bidAmount: parseFloat(bidAmount)
        }
      });
    } catch (err) {
      setError(err.message);
    }
  };

  if (groupLoading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <p className="text-gray-600">Loading group details...</p>
      </div>
    );
    }

  if (groupData?.groupDetails?.status !== 'started') {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <p className="text-gray-600">Bidding has not started yet.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4 text-black">Bidding</h2>
      
      {timeLeft && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-medium text-blue-800 mb-2">Time Remaining</h3>
          <div className="flex space-x-4">
            <div className="text-center">
              <span className="text-2xl font-bold text-blue-600">{timeLeft.days}</span>
              <span className="block text-sm text-blue-500">Days</span>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-blue-600">{timeLeft.hours}</span>
              <span className="block text-sm text-blue-500">Hours</span>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-blue-600">{timeLeft.minutes}</span>
              <span className="block text-sm text-blue-500">Minutes</span>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-blue-600">{timeLeft.seconds}</span>
              <span className="block text-sm text-blue-500">Seconds</span>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2 text-gray-800">Current Lowest Bid</h3>
        {currentBidLoading ? (
          <p>Loading...</p>
        ) : currentBidData?.getCurrentBid ? (
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-2xl font-bold text-green-600">
              ₹{currentBidData.getCurrentBid.bidAmount.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">
              By {currentBidData.getCurrentBid.username}
            </p>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-2xl font-bold text-gray-900">
              ₹{groupData?.groupDetails?.totalPoolAmount.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">
              Initial Pool Amount
            </p>
          </div>
        )}
      </div>

      {!isWinner && (
      <form onSubmit={handlePlaceBid} className="mb-6">
        <div className="mb-4">
          <label htmlFor="bidAmount" className="block text-sm font-medium text-gray-700 mb-1">
            Your Bid Amount (₹)
          </label>
          <input
            type="number"
            id="bidAmount"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your bid amount"
            step="0.01"
            min="0"
            disabled={groupData?.groupDetails?.currentmonth === groupData?.groupDetails?.totalMonths}
          />
        </div>
        <button
          type="submit"
          className={`w-full py-2 px-4 rounded transition-colors ${
            groupData?.groupDetails?.currentmonth === groupData?.groupDetails?.totalMonths
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          disabled={groupData?.groupDetails?.currentmonth === groupData?.groupDetails?.totalMonths}
        >
          {groupData?.groupDetails?.currentmonth === groupData?.groupDetails?.totalMonths
            ? 'Bidding Closed'
            : 'Place Bid'}
        </button>
      </form>
      )}

      <div>
        <h3 className="text-lg font-medium mb-2 text-gray-800">Bid History</h3>
        {bidHistoryLoading ? (
          <p>Loading...</p>
        ) : bidHistoryData?.getBidHistory?.length > 0 ? (
          <div className="space-y-2">
            {bidHistoryData.getBidHistory
              .filter(bid => bid.currentmonth === groupData?.groupDetails?.currentmonth)
              .map((bid) => (
              <div
                key={bid.id}
                className={`p-3 rounded ${
                  bid.isWinner ? 'bg-green-100' : 'bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <p className="text-xl font-semibold text-gray-900">
                        ₹{bid.bidAmount.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="font-medium text-gray-700">{bid.username}</span>
                      <span className="mx-2">•</span>
                      <span>{new Date(bid.createdAt).toLocaleString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {bidHistoryData.getBidHistory.filter(bid => 
              bid.currentmonth === groupData?.groupDetails?.currentmonth
            ).length === 0 && (
              <p className="text-gray-600">No bids for the current month</p>
            )}
          </div>
        ) : (
          <p className="text-gray-600">No bids yet</p>
        )}
      </div>
    </div>
  );
};

export default Bidding; 