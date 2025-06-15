import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gql, useMutation, useApolloClient } from '@apollo/client';
import Cookies from 'js-cookie';

const AuthContext = createContext(null);

const LOGIN_MUTATION = gql`
  mutation Login($usernameOrEmailOrMobile: String!, $password: String!) {
    login(usernameOrEmailOrMobile: $usernameOrEmailOrMobile, password: $password) {
      token
      user {
        id
        username
        email
        mobile
        age
        gender
      }
    }
  }
`;

const REGISTER_MUTATION = gql`
  mutation Register($username: String!, $email: String!, $password: String!, $mobile: String!, $age: Int, $gender: String) {
    register(username: $username, email: $email, password: $password, mobile: $mobile, age: $age, gender: $gender) {
      token
      user {
        id
        username
        email
        mobile
        age
        gender
      }
    }
  }
`;

const ME_QUERY = gql`
  query Me {
    me {
      id
      username
      email
      mobile
      age
      gender
    }
  }
`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const apolloClient = useApolloClient();
  const navigate = useNavigate();

  const [loginMutation] = useMutation(LOGIN_MUTATION);
  const [registerMutation] = useMutation(REGISTER_MUTATION);

  const fetchUserData = async () => {
    try {
      const { data } = await apolloClient.query({
        query: ME_QUERY,
        fetchPolicy: 'network-only'
      });
      
      if (data?.me) {
        setUser(data.me);
        return true;
      }
      return false;
    } catch (error) {
      if (error.message.includes('Not authenticated')) {
        Cookies.remove('authToken');
        setUser(null);
      }
      return false;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = Cookies.get('authToken');
      if (token) {
        await fetchUserData();
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (usernameOrEmailOrMobile, password) => {
    try {
      const { data } = await loginMutation({
        variables: {
          usernameOrEmailOrMobile,
          password,
        },
      });

      if (!data?.login) {
        throw new Error('Login failed. Please check your credentials.');
      }

      const { token, user } = data.login;
      
      // Store token in cookie
      Cookies.set('authToken', token, { expires: 1 }); // 1 day expiry
      
      // Update Apollo Client cache
      await apolloClient.resetStore();
      
      // Set user state
      setUser(user);
      
      // Navigate to home
      navigate('/home');
      
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Failed to login. Please try again.');
    }
  };

  const register = async (username, email, password, mobile, age, gender) => {
    try {
      const { data } = await registerMutation({
        variables: {
          username,
          email,
          password,
          mobile,
          age: age ? parseInt(age) : null,
          gender,
        },
      });

      if (!data?.register) {
        throw new Error('Registration failed. Please try again.');
      }

      const { token, user } = data.register;
      
      // Store token in cookie
      Cookies.set('authToken', token, { expires: 1 }); // 1 day expiry
      
      // Update Apollo Client cache
      await apolloClient.resetStore();
      
      // Set user state
      setUser(user);
      
      // Navigate to home
      navigate('/home');
      
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Failed to register. Please try again.');
    }
  };

  const logout = async () => {
    Cookies.remove('authToken');
    setUser(null);
    await apolloClient.resetStore();
    navigate('/login');
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser: fetchUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 