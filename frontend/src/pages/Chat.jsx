import { useState, useEffect, useRef } from 'react';
import { chatAPI } from '../services/api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import './Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const messagesEndRef = useRef(null);

  const studentId = localStorage.getItem('studentId');

  useEffect(() => {
    if (!studentId) {
      setAlert({
        type: 'error',
        message: 'Please create your profile first to start chatting.'
      });
    } else {
      // Add welcome message
      setMessages([{
        id: 1,
        type: 'ai',
        content: 'Hello! I\'m your AI Mentor. Ask me anything about your learning journey, and I\'ll help you understand concepts, solve problems, and guide your progress.',
        timestamp: new Date()
      }]);
    }
  }, [studentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!inputMessage.trim()) return;
    if (!studentId) {
      showAlert('error', 'Please create your profile first.');
      return;
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await chatAPI.sendMessage({
        student_id: parseInt(studentId),
        message: userMessage.content
      });

      // Improved error handling for response structure
      if (!response || !response.response) {
        throw new Error('Invalid response from mentor service');
      }

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: response.response,
        timestamp: new Date(),
        metadata: {
          concept: response.target_concept,
          style: response.explanation_style,
          followUp: response.follow_up_question
        }
      };

      setMessages(prev => [...prev, aiMessage]);
      showAlert('success', 'Mentor responded successfully!');
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Improved error message
      let errorMsg = 'Failed to send message. Please try again.';
      if (error.response?.status === 404) {
        errorMsg = 'Student profile not found. Please update your profile.';
      } else if (error.response?.status === 422) {
        errorMsg = 'Invalid student ID. Please create a new profile.';
      } else if (error.message === 'Invalid response from mentor service') {
        errorMsg = 'Mentor service returned invalid response. Please try again.';
      }
      
      showAlert('error', errorMsg);

      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: `Sorry, I encountered an error: ${errorMsg}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!studentId) {
    return (
      <div className="chat-page">
        <div className="container">
          <Alert
            type={alert?.type}
            message={alert?.message}
          />
          <div className="card">
            <div className="card-header">
              <h1 className="card-title">AI Chat</h1>
            </div>
            <p>Please create your profile first to start chatting with the AI mentor.</p>
            <a href="/profile" className="btn btn-primary">Create Profile</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <div className="container">
        <div className="chat-container">
          <div className="chat-header">
            <h1>🤖 AI Mentor Chat</h1>
            <p>Ask me anything about your learning journey</p>
          </div>

          <Alert
            type={alert?.type}
            message={alert?.message}
            onClose={() => setAlert(null)}
          />

          <div className="chat-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message message-${message.type}`}
              >
                <div className="message-content">
                  {message.content}
                </div>
                <div className="message-time">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="message message-ai">
                <div className="message-content">
                  <LoadingSpinner size="small" message="AI is thinking..." />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-container" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="chat-input"
              placeholder="Ask me anything about your learning..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !inputMessage.trim()}
            >
              {loading ? (
                <div className="spinner spinner-small"></div>
              ) : (
                'Send'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;