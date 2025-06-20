import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, gql, useLazyQuery } from '@apollo/client';
import { FaUsers, FaMoneyBillWave, FaGavel, FaChevronLeft, FaEdit, FaPlus, FaSearch, FaUserPlus, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import Navbar from './Navbar';
import { useAuth } from '../context/AuthContext';
import debounce from 'lodash/debounce';
import Bidding from './Bidding';

const GET_GROUP_DETAILS = gql`
  query GroupDetails($groupId: ID!) {
    groupDetails(groupId: $groupId) {
      id
      name
      totalPoolAmount
      totalMonths
      status
      shuffleDate
      createdAt
      owner {
        id
        username
        email
        mobile
      }
    }
    groupParticipants(groupId: $groupId) {
      username
      joinedAt
    }
  }
`;

const UPDATE_GROUP_DETAILS = gql`
  mutation UpdateGroupDetails(
    $groupId: ID!
    $name: String
    $totalPoolAmount: Float
    $totalMonths: Int
  ) {
    updateGroupDetails(
      groupId: $groupId
      name: $name
      totalPoolAmount: $totalPoolAmount
      totalMonths: $totalMonths
    ) {
      id
      name
      totalPoolAmount
      totalMonths
      status
      createdAt
      owner {
        id
        username
      }
    }
  }
`;

const INVITE_TO_GROUP = gql`
  mutation InviteToGroup($groupId: ID!, $username: String!) {
    inviteToGroup(groupId: $groupId, username: $username)
  }
`;

const SEARCH_USER = gql`
  query SearchUser($emailOrMobile: String!) {
    searchUser(emailOrMobile: $emailOrMobile) {
      id
      username
      email
      mobile
    }
  }
`;

const GET_CONNECTIONS = gql`
  query GetConnections {
    connections {
      id
      username
      email
      mobile
    }
  }
`;

const GET_GROUP_OUTGOING_INVITES = gql`
  query GetGroupOutgoingInvites($groupId: ID!) {
    getGroupOutgoingInvites(groupId: $groupId)
  }
`;

const GET_GROUP_PENDING_INVITES = gql`
  query GroupPendingInvites($groupId: ID!) {
    groupPendingInvites(groupId: $groupId)
  }
`;

const START_GROUP = gql`
  mutation StartGroup($groupId: ID!) {
    startGroup(groupId: $groupId)
  }
`;

const GET_ALL_BID_DETAILS = gql`
  query GetAllBidDetails($groupId: ID!) {
    getAllBidDetails(groupId: $groupId) {
      id
      bidAmount
      username
      createdAt
      isWinner
      currentmonth
    }
  }
`;

const GroupDetails = () => {
  const { groupId, groupName } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPoolAmount, setEditPoolAmount] = useState('');
  const [editTotalMonths, setEditTotalMonths] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [invitingUsers, setInvitingUsers] = useState(new Set());
  const [groupPendingInvitations, setGroupPendingInvitations] = useState(new Set());
  const [expandedMonths, setExpandedMonths] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [searchSuccess, setSearchSuccess] = useState('');

  const { data: groupData, loading: groupLoading, error: groupError } = useQuery(GET_GROUP_DETAILS, {
    variables: { groupId },
    pollInterval: 2000,
    fetchPolicy: 'network-only'
  });

  const { data: connectionsData, loading: connectionsLoading, refetch: connectionsRefetch } = useQuery(GET_CONNECTIONS, {
    skip: !user,
  });

  const { data: groupPendingInvitesData, loading: groupPendingInvitesLoading, error: groupPendingInvitesError } = useQuery(GET_GROUP_PENDING_INVITES, {
    variables: { groupId },
    skip: !user || !groupData?.groupDetails,
  });

  const { data: allBidDetailsData, loading: allBidDetailsLoading, error: allBidDetailsError } = useQuery(GET_ALL_BID_DETAILS, {
    variables: { groupId },
    pollInterval: 2000,
    fetchPolicy: 'network-only'
  });

  const [updateGroupMutation] = useMutation(UPDATE_GROUP_DETAILS, {
    onCompleted: () => {
      console.log('Group details updated successfully!');
      setIsEditing(false);
      refetch();
    },
    onError: (err) => {
      console.error(`Error updating group: ${err.message}`);
    },
  });

  const { loading: searchLoading, data: searchData, refetch: searchRefetch } = useQuery(SEARCH_USER, {
    variables: { emailOrMobile: searchQuery },
    skip: !searchQuery,
    onError: (error) => {
      setSearchError(error.message);
      setSearchSuccess('');
    }
  });

  const debouncedSearch = useCallback(
    debounce((query) => {
      if (query.trim()) {
        searchRefetch();
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (searchQuery.trim()) {
      debouncedSearch(searchQuery);
    }
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchRefetch();
    }
  };

  const [inviteToGroupMutation] = useMutation(INVITE_TO_GROUP, {
    onCompleted: (data, { variables }) => {
      const invitedUsername = variables.username;
      if (invitedUsername) {
        setInvitingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(invitedUsername);
          return newSet;
        });
      }

      if (data.inviteToGroup) {
        setSearchSuccess('Invitation sent successfully!');
        setSearchError('');
        setGroupPendingInvitations(prev => new Set(prev).add(invitedUsername));
        refetch();
        connectionsRefetch();
      } else {
        setSearchError('Invitation could not be sent (e.g., user already invited/participant).');
        setSearchSuccess('');
      }
    },
    onError: (err) => {
      const invitedUsername = variables.username;
      if (invitedUsername) {
        setInvitingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(invitedUsername);
          return newSet;
        });
      }
      setSearchError(err.message);
      setSearchSuccess('');
    },
  });

  const [startGroupMutation] = useMutation(START_GROUP, {
    onCompleted: () => {
      console.log('Group started successfully!');
      refetch();
    },
    onError: (err) => {
      console.error(`Error starting group: ${err.message}`);
    },
  });

  useEffect(() => {
    if (groupPendingInvitesData?.groupPendingInvites) {
      setGroupPendingInvitations(new Set(groupPendingInvitesData.groupPendingInvites));
    }
  }, [groupPendingInvitesData]);

  const group = groupData?.groupDetails;
  const participants = groupData?.groupParticipants || [];
  const isOwner = user?.username === group?.owner?.username;
  const isWaiting = group?.status === 'waiting';
  const connections = connectionsData?.connections || [];

  const isAlreadyParticipantOrInvited = (username) => {
    return participants.some(p => p.username === username) || groupPendingInvitations.has(username);
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!editName || !editPoolAmount || !editTotalMonths) {
      console.error('All fields are required to update group details.');
      return;
    }

    await updateGroupMutation({
      variables: {
        groupId,
        name: editName,
        totalPoolAmount: parseFloat(editPoolAmount),
        totalMonths: parseInt(editTotalMonths, 10),
      },
    });
  };

  const handleInviteUser = async (usernameToInvite) => {
    if (participants.length >= group.totalMonths) {
      console.warn('Group is already full. Cannot invite more members.');
      return;
    }
    
    if (invitingUsers.has(usernameToInvite) || isAlreadyParticipantOrInvited(usernameToInvite)) {
      console.log(`Already inviting or already invited/participant: ${usernameToInvite}`);
      return;
    }

    setInvitingUsers(prev => new Set(prev).add(usernameToInvite));
    try {
      await inviteToGroupMutation({ variables: { groupId, username: usernameToInvite } });
    } catch (error) {
      console.error('Caught error in handleInviteUser', error);
    }
  };

  const handleStartGroup = async () => {
    try {
      await startGroupMutation({ variables: { groupId } });
    } catch (error) {
      console.error('Error starting group:', error);
    }
  };

  const toggleMonth = (month) => {
    setExpandedMonths((prev) =>
      prev.includes(month)
        ? prev.filter((m) => m !== month)
        : [...prev, month]
    );
  };

  const handleEditClick = () => {
    setEditName(group.name);
    setEditPoolAmount(group.totalPoolAmount);
    setEditTotalMonths(group.totalMonths);
    setIsEditing(true);
  };

  const sidebarItems = [
    { id: 'details', label: 'Group Details', icon: <FaUsers /> },
    { id: 'pastevents', label: 'Past Events', icon: <FaMoneyBillWave /> },
    { id: 'bid', label: 'Bid', icon: <FaGavel /> }
  ];

  if (groupLoading || groupPendingInvitesLoading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );

  if (groupError || groupPendingInvitesError || allBidDetailsError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">
              {groupError?.message || groupPendingInvitesError?.message || allBidDetailsError?.message || 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!group) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="pt-20 px-4">
        <div className="max-w-7xl mx-auto text-center py-8">
          <p className="text-gray-600">Group not found.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center mb-6">
            <button
              onClick={() => navigate('/home')}
              className="mr-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              <FaChevronLeft />
            </button>
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">{groupName}</h1>
              <span className={`ml-4 px-3 py-1 rounded-full text-sm font-medium ${
                group.status === 'started' ? 'bg-green-100 text-green-800' :
                group.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {group.status}
              </span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar */}
            <div className="w-full lg:w-64 flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <nav className="space-y-1 py-2">
                  {sidebarItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center px-4 py-3.5 text-sm font-medium transition-colors ${
                        activeTab === item.id
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="mr-3 text-lg">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                {activeTab === 'details' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold text-gray-800">Group Details</h2>
                      {isOwner && isWaiting && (
                        <button
                          onClick={isEditing ? () => setIsEditing(false) : handleEditClick}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center text-sm"
                        >
                          <FaEdit className="mr-2" />
                          {isEditing ? 'Cancel Edit' : 'Edit Details'}
                        </button>
                      )}
                    </div>
                    
                    {!isEditing ? (
                      <div className="space-y-4 text-gray-700">
                        <p><span className="font-medium">Group Name:</span> {group.name}</p>
                        <p><span className="font-medium">Pool Amount:</span> {group.totalPoolAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                        <p><span className="font-medium">Total Months:</span> {group.totalMonths} months</p>
                        <p><span className="font-medium">Status:</span> {group.status}</p>
                        <p><span className="font-medium">Created At:</span> {new Date(group.createdAt).toLocaleDateString()}</p>
                        <h3 className="text-lg font-semibold mt-6">Current Participants ({participants.length}/{group.totalMonths})</h3>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          {participants.map((p, index) => (
                            <li key={index} className="text-gray-800">{p.username}</li>
                          ))}
                        </ul>

                        {/* Start Group Button */}
                        {isOwner && group.status === 'waiting' && participants.length === group.totalMonths && (
                          <div className="mt-8 flex justify-center">
                            <button
                              onClick={handleStartGroup}
                              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              Start Group
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={handleUpdateGroup} className="space-y-4">
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Group Name</label>
                          <input
                            type="text"
                            id="name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="poolAmount" className="block text-sm font-medium text-gray-700">Total Pool Amount</label>
                          <input
                            type="number"
                            id="poolAmount"
                            value={editPoolAmount}
                            onChange={(e) => setEditPoolAmount(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            min="1000"
                          />
                        </div>
                        <div>
                          <label htmlFor="totalMonths" className="block text-sm font-medium text-gray-700">Total Months</label>
                          <input
                            type="number"
                            id="totalMonths"
                            value={editTotalMonths}
                            onChange={(e) => setEditTotalMonths(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            min="1"
                            max="12"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Save Changes
                        </button>
                      </form>
                    )}
                    
                    {isOwner && isWaiting && (
                      <div className="mt-8 border-t border-gray-200 pt-8">
                        
                        {/* Search Section */}
                        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invite New Members</h2>
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
                                    {!isAlreadyParticipantOrInvited(user.username) ? (
                                      <button
                                        onClick={() => handleInviteUser(user.username)}
                                        disabled={invitingUsers.has(user.username)}
                                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center gap-2"
                                      >
                                        <FaUserPlus />
                                        {invitingUsers.has(user.username) ? 'Inviting...' : 'Invite'}
                                      </button>
                                    ) : (
                                      <span className="px-4 py-2 bg-gray-200 text-gray-600 rounded-md">
                                        Already Invited/Participant
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Connections Section */}
                        {connections.length > 0 && (
                          <div className="bg-gray-50 rounded-md p-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Invite from your Connections:</p>
                            <ul className="space-y-2">
                              {connections.map((friend) => {
                                const isInvited = groupPendingInvitations.has(friend.username);
                                const isDisabled = invitingUsers.has(friend.username) || isInvited || participants.some(p => p.username === friend.username);
                                const buttonClassName = `px-3 py-1.5 rounded-md transition-colors flex items-center text-sm ${
                                  isDisabled
                                    ? 'bg-gray-400 text-white cursor-not-allowed'
                                    : 'bg-green-500 text-white hover:bg-green-600'
                                }`;
                                console.log(`Connection User: ${friend.username}, isInvited: ${isInvited}, isDisabled: ${isDisabled}, groupPendingInvitations:`, Array.from(groupPendingInvitations));
                                return (
                                  <li key={friend.id} className="flex justify-between items-center bg-white p-3 rounded-md shadow-sm border border-gray-100">
                                    <div>
                                      <span className="font-medium text-gray-900">{friend.username}</span>
                                    </div>
                                    {participants.length < group.totalMonths ? (
                                      <button
                                        onClick={() => handleInviteUser(friend.username)}
                                        disabled={isDisabled}
                                        className={buttonClassName}
                                      >
                                        <FaUserPlus className="mr-2" /> 
                                        {invitingUsers.has(friend.username) ? 'Sending...' :
                                          (isInvited ? 'Invited' : 'Invite')}
                                      </button>
                                    ) : (
                                      <span className="text-sm text-gray-500">Group Full</span>
                                    )}
                                  </li>
                                );
                              })}
                              {connections.length === 0 && (
                                <li className="text-center text-gray-500">All your connections are already in the group or have pending invites.</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'pastevents' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-6">Past Events</h2>
                    {allBidDetailsLoading ? (
                      <div className="animate-pulse space-y-4">
                        {[...Array(groupData?.groupDetails?.totalMonths)].map((_, i) => (
                          <div key={i} className="bg-gray-100 rounded-lg p-6 h-48"></div>
                        ))}
                      </div>
                    ) : allBidDetailsData?.getAllBidDetails ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(groupData?.groupDetails?.totalMonths)].map((_, monthIndex) => {
                          const month = monthIndex + 1;
                          const monthBids = allBidDetailsData.getAllBidDetails.filter(
                            bid => bid.currentmonth === month
                          );
                          const winningBid = monthBids.find(bid => bid.isWinner);
                          const hasBids = monthBids.length > 0;

                          return (
                            <div key={month} className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">Month {month}</h3>
                                <div className="flex items-center space-x-2">
                                  {winningBid && (
                                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                      Completed
                                    </span>
                                  )}
                                  {hasBids && (
                                    <button
                                      className="ml-2 p-1 rounded hover:bg-gray-100 focus:outline-none"
                                      onClick={() => toggleMonth(month)}
                                      aria-label={expandedMonths.includes(month) ? 'Collapse' : 'Expand'}
                                    >
                                      {expandedMonths.includes(month) ? <FaChevronUp /> : <FaChevronDown />}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {winningBid ? (
                                <div className="space-y-4">
                                  <div className="bg-green-50 rounded-lg p-4">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-600">Winner</span>
                                      <span className="font-medium text-gray-900">{winningBid.username}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                      <span className="text-sm text-gray-600">Winning Bid</span>
                                      <span className="font-medium text-green-600">₹{winningBid.bidAmount.toLocaleString()}</span>
                                    </div>
                                  </div>
                                  {hasBids && expandedMonths.includes(month) && (
                                    <div className="mt-4">
                                      <h4 className="text-sm font-medium text-gray-700 mb-2">All Bids</h4>
                                      <div className="space-y-2">
                                        {monthBids.map(bid => (
                                          <div key={bid.id} className={`flex justify-between items-center text-sm ${bid.isWinner ? 'font-semibold text-green-700' : ''}`}>
                                            <span className="text-gray-600">{bid.username}</span>
                                            <span className="text-gray-900">₹{bid.bidAmount.toLocaleString()}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <p className="text-gray-500">No bids for this month</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500">No bidding history available</p>
                    )}
                  </div>
                )}

                {activeTab === 'bid' && (
                  <Bidding
                    groupId={groupId}
                    shuffleDate={groupData?.groupDetails?.shuffleDate}
                    status={groupData?.groupDetails?.status}
                    isOwner={groupData?.groupDetails?.owner?.username === user?.username}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupDetails; 