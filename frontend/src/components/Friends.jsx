import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import Navbar from './Navbar';
import { FaSearch, FaUserPlus, FaUserMinus, FaUserFriends } from 'react-icons/fa';
import debounce from 'lodash/debounce';

const SEARCH_USER = gql`
  query SearchUser($emailOrMobile: String!) {
    searchUser(emailOrMobile: $emailOrMobile) {
      username
      email
      mobile
    }
  }
`;

const GET_CONNECTIONS = gql`
  query GetConnections {
    connections {
      username
      email
      mobile
    }
  }
`;

const SEND_CONNECTION_REQUEST = gql`
  mutation SendConnectionRequest($targetUsername: String!) {
    sendConnectionRequest(targetUsername: $targetUsername)
  }
`;

const REMOVE_CONNECTION = gql`
  mutation RemoveConnection($targetUsername: String!) {
    removeConnection(targetUsername: $targetUsername)
  }
`;

const Friends = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchSuccess, setSearchSuccess] = useState('');

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query) => {
      if (query.trim()) {
        searchRefetch();
      }
    }, 300),
    []
  );

  // Search user query
  const { loading: searchLoading, data: searchData, refetch: searchRefetch } = useQuery(SEARCH_USER, {
    variables: { emailOrMobile: searchQuery },
    skip: !searchQuery,
    onError: (error) => {
      setSearchError(error.message);
      setSearchSuccess('');
    }
  });

  // Effect to trigger debounced search
  useEffect(() => {
    if (searchQuery.trim()) {
      debouncedSearch(searchQuery);
    }
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  // Get connections query
  const { loading: connectionsLoading, data: connectionsData, refetch: connectionsRefetch } = useQuery(GET_CONNECTIONS, {
    fetchPolicy: 'network-only'
  });

  // Send connection request mutation
  const [sendRequest, { loading: requestLoading }] = useMutation(SEND_CONNECTION_REQUEST, {
    onCompleted: () => {
      setSearchSuccess('Connection request sent successfully!');
      setSearchError('');
      searchRefetch();
    },
    onError: (error) => {
      setSearchError(error.message);
      setSearchSuccess('');
    }
  });

  // Remove connection mutation
  const [removeConnection, { loading: removeLoading }] = useMutation(REMOVE_CONNECTION, {
    onCompleted: () => {
      connectionsRefetch();
    }
  });

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchRefetch();
    }
  };

  const handleSendRequest = async (username) => {
    try {
      await sendRequest({ variables: { targetUsername: username } });
    } catch (error) {
      console.error('Error sending request:', error);
    }
  };

  const handleRemoveConnection = async (username) => {
    try {
      await removeConnection({ variables: { targetUsername: username } });
    } catch (error) {
      console.error('Error removing connection:', error);
    }
  };

  const isAlreadyConnected = (username) => {
    return connectionsData?.connections?.some(
      connection => connection.username === username
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      
      <main className="pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Search Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Find Friends</h2>
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username, email or mobile number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={searchLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-2"
              >
                <FaSearch />
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>

            {searchError && (
              <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-md">
                {searchError}
              </div>
            )}

            {searchSuccess && (
              <div className="mt-4 p-4 bg-green-50 text-green-600 rounded-md">
                {searchSuccess}
              </div>
            )}

            {searchData?.searchUser && searchData.searchUser.length > 0 && (
              <div className="mt-4 space-y-4">
                {searchData.searchUser.map((user) => (
                  <div key={user.username} className="p-4 bg-gray-50 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg text-black">{user.username}</h3>
                      </div>
                      {!isAlreadyConnected(user.username) ? (
                        <button
                          onClick={() => handleSendRequest(user.username)}
                          disabled={requestLoading}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center gap-2"
                        >
                          <FaUserPlus />
                          {requestLoading ? 'Sending...' : 'Add Friend'}
                        </button>
                      ) : (
                        <span className="px-4 py-2 bg-gray-200 text-gray-600 rounded-md">
                          Already Connected
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Connections Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">My Connections</h2>
            {connectionsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading connections...</p>
              </div>
            ) : connectionsData?.connections && connectionsData.connections.length > 0 ? (
              <div className="space-y-4">
                {connectionsData.connections.map((connection) => (
                  <div key={connection.username} className="p-4 bg-gray-50 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg text-black">{connection.username}</h3>
                      </div>
                      <button
                        onClick={() => handleRemoveConnection(connection.username)}
                        disabled={removeLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center gap-2"
                      >
                        <FaUserMinus />
                        {removeLoading ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FaUserFriends className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No connections yet</h3>
                <p className="mt-1 text-sm text-gray-500">Start by searching for friends above</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Friends; 