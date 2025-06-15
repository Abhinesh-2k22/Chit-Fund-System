import React, { useState, useEffect } from 'react';

const Bidding = ({ shuffleDate, status }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    if (!shuffleDate || status !== 'started') return;

    const calculateTimeLeft = () => {
      const shuffleDateTime = new Date(shuffleDate);
      const difference = shuffleDateTime - new Date();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        setTimeLeft({ days: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [shuffleDate, status]);

  const formatShuffleDate = (dateString) => {
    if (!dateString) return 'Not started';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (status !== 'started') {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Bidding</h2>
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <p className="text-gray-600">Bidding will be available once the group starts.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Bidding</h2>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-700 mb-2">Time Until Next Shuffle</h3>
        <p className="text-sm text-gray-500 mb-4">Shuffle Date: {formatShuffleDate(shuffleDate)}</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{timeLeft.days}</div>
            <div className="text-sm text-gray-500">Days</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{timeLeft.minutes}</div>
            <div className="text-sm text-gray-500">Minutes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{timeLeft.seconds}</div>
            <div className="text-sm text-gray-500">Seconds</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bidding; 