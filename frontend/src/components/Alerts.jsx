import { useQuery, useMutation, gql } from '@apollo/client';
import Navbar from './Navbar';
import { FaUserPlus, FaUserMinus, FaUsers, FaCheck, FaTimes } from 'react-icons/fa';

const GET_PENDING_CONNECTION_REQUESTS = gql`
  query GetPendingConnectionRequests {
    pendingConnectionRequests {
      username
    }
  }
`;

const GET_PENDING_GROUP_INVITES = gql`
  query GetPendingGroupInvites {
    pendingGroupInvites {
      groupId
      groupName
      invitedBy
      invitedAt
    }
  }
`;

const ACCEPT_CONNECTION_REQUEST = gql`
  mutation AcceptConnectionRequest($fromUsername: String!) {
    acceptConnectionRequest(fromUsername: $fromUsername)
  }
`;

const REJECT_CONNECTION_REQUEST = gql`
  mutation RejectConnectionRequest($fromUsername: String!) {
    rejectConnectionRequest(fromUsername: $fromUsername)
  }
`;

const ACCEPT_GROUP_INVITE = gql`
  mutation AcceptGroupInvite($groupId: ID!) {
    acceptGroupInvite(groupId: $groupId)
  }
`;

const REJECT_GROUP_INVITE = gql`
  mutation RejectGroupInvite($groupId: ID!) {
    rejectGroupInvite(groupId: $groupId)
  }
`;

const Alerts = () => {
  // Fetch pending connection requests
  const { 
    loading: connectionRequestsLoading, 
    data: connectionRequestsData,
    refetch: refetchConnectionRequests 
  } = useQuery(GET_PENDING_CONNECTION_REQUESTS, {
    fetchPolicy: 'network-only'
  });

  // Fetch pending group invites
  const { 
    loading: groupInvitesLoading, 
    data: groupInvitesData,
    refetch: refetchGroupInvites 
  } = useQuery(GET_PENDING_GROUP_INVITES, {
    fetchPolicy: 'network-only'
  });

  // Connection request mutations
  const [acceptConnectionRequest] = useMutation(ACCEPT_CONNECTION_REQUEST, {
    onCompleted: () => refetchConnectionRequests()
  });

  const [rejectConnectionRequest] = useMutation(REJECT_CONNECTION_REQUEST, {
    onCompleted: () => {
      refetchConnectionRequests();
    },
    onError: (error) => {
      console.error('Error rejecting connection request:', error);
      alert(error.message || 'Failed to reject connection request');
    }
  });

  // Group invite mutations
  const [acceptGroupInvite] = useMutation(ACCEPT_GROUP_INVITE, {
    onCompleted: () => {
      refetchGroupInvites();
    },
    onError: (error) => {
      console.error('Error accepting group invite:', error);
    }
  });

  const [rejectGroupInvite] = useMutation(REJECT_GROUP_INVITE, {
    onCompleted: () => {
      refetchGroupInvites();
    },
    onError: (error) => {
      console.error('Error rejecting group invite:', error);
    }
  });

  const handleAcceptConnection = async (username) => {
    try {
      await acceptConnectionRequest({ variables: { fromUsername: username } });
    } catch (error) {
      console.error('Error accepting connection request:', error);
    }
  };

  const handleRejectConnection = async (username) => {
    try {
      await rejectConnectionRequest({ 
        variables: { fromUsername: username },
        onError: (error) => {
          console.error('Error rejecting connection request:', error);
          alert(error.message || 'Failed to reject connection request');
        }
      });
    } catch (error) {
      console.error('Error rejecting connection request:', error);
      alert(error.message || 'Failed to reject connection request');
    }
  };

  const handleAcceptGroupInvite = async (groupId) => {
    try {
      await acceptGroupInvite({ variables: { groupId } });
    } catch (error) {
      console.error('Error accepting group invite:', error);
    }
  };

  const handleRejectGroupInvite = async (groupId) => {
    try {
      await rejectGroupInvite({ variables: { groupId } });
    } catch (error) {
      console.error('Error rejecting group invite:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      
      <main className="pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Connection Requests Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Connection Requests</h2>
            {connectionRequestsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading requests...</p>
              </div>
            ) : connectionRequestsData?.pendingConnectionRequests?.length > 0 ? (
              <div className="space-y-4">
                {connectionRequestsData.pendingConnectionRequests.map((request) => (
                  <div key={request.username} className="p-4 bg-gray-50 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg text-black">{request.username}</h3>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptConnection(request.username)}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center gap-2"
                        >
                          <FaCheck />
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectConnection(request.username)}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center gap-2"
                        >
                          <FaTimes />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FaUserPlus className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No pending requests</h3>
                <p className="mt-1 text-sm text-gray-500">You have no pending connection requests</p>
              </div>
            )}
          </div>

          {/* Group Invites Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Group Invites</h2>
            {groupInvitesLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading invites...</p>
              </div>
            ) : groupInvitesData?.pendingGroupInvites?.length > 0 ? (
              <div className="space-y-4">
                {groupInvitesData.pendingGroupInvites.map((invite) => (
                  <div key={invite.groupId} className="p-4 bg-gray-50 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg text-black">{invite.groupName}</h3>
                        <p className="text-sm text-gray-600">Invited by: {invite.invitedBy}</p>
                        <p className="text-sm text-gray-500">Invited at: {formatDate(invite.invitedAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptGroupInvite(invite.groupId)}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center gap-2"
                        >
                          <FaCheck />
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectGroupInvite(invite.groupId)}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center gap-2"
                        >
                          <FaTimes />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FaUsers className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No pending invites</h3>
                <p className="mt-1 text-sm text-gray-500">You have no pending group invites</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Alerts; 