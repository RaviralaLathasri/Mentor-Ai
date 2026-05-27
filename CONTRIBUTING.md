# 🤝 Contributing to Mentor AI

First off, thank you for considering contributing to Mentor AI! It's people like you that make Mentor AI such a great tool for education and learning.

## 📋 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please read and abide by our Code of Conduct:

- **Be respectful** - Treat everyone with respect and kindness
- **Be inclusive** - Welcome people of all backgrounds and experience levels
- **Be constructive** - Provide helpful feedback and suggestions
- **Be professional** - Maintain professional communication at all times

## 🐛 Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

### Bug Report Template

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment (please complete the following information):**
 - OS: [e.g. Windows 10, macOS 12, Ubuntu 20.04]
 - Python Version: [e.g. 3.9, 3.10]
 - Node Version: [e.g. 16.0, 18.0]
 - Browser: [e.g. Chrome, Firefox, Safari]

**Additional context**
Add any other context about the problem here.
```

## 🎯 Feature Requests

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

### Feature Request Template

```markdown
**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
```

## 🚀 Pull Request Process

### Before You Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/Mentor-Ai.git
   cd Mentor-Ai
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/RaviralaLathasri/Mentor-Ai.git
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Making Changes

#### Backend (Python/FastAPI)

1. **Install development dependencies**:
   ```bash
   pip install -r requirements.txt
   pip install black pylint mypy pytest pytest-cov
   ```

2. **Follow code style**:
   - Use Black for formatting: `black app/`
   - Use 4-space indentation
   - Add docstrings to all functions
   - Use type hints where possible

3. **Example function with proper documentation**:
   ```python
   def calculate_student_difficulty(
       feedback_scores: dict, 
       current_difficulty: int
   ) -> int:
       """
       Calculate adaptive difficulty based on feedback scores.
       
       Args:
           feedback_scores: Dictionary with feedback counts
           current_difficulty: Current difficulty level (1-10)
       
       Returns:
           Adjusted difficulty level
           
       Raises:
           ValueError: If difficulty outside valid range
       """
       if not 1 <= current_difficulty <= 10:
           raise ValueError("Difficulty must be between 1 and 10")
       
       # Implementation here
       return adjusted_difficulty
   ```

4. **Write tests**:
   ```bash
   # Create test file: tests/test_your_feature.py
   pytest tests/ -v
   ```

#### Frontend (React/JavaScript)

1. **Install development dependencies**:
   ```bash
   cd frontend
   npm install
   npm install --save-dev eslint prettier
   ```

2. **Follow code style**:
   - Use 2-space indentation for JSX
   - Use functional components with hooks
   - Add PropTypes or TypeScript types
   - Use descriptive variable names

3. **Example component**:
   ```jsx
   import React, { useState } from 'react';
   import PropTypes from 'prop-types';
   
   /**
    * StudentFeedback - Allows students to rate mentor responses
    * @param {Object} props - Component props
    * @param {number} props.responseId - ID of the response
    * @param {Function} props.onSubmit - Callback when feedback submitted
    * @returns {React.ReactElement}
    */
   function StudentFeedback({ responseId, onSubmit }) {
     const [selectedRating, setSelectedRating] = useState(null);
     
     return (
       <div className="feedback-container">
         {/* Component JSX */}
       </div>
     );
   }
   
   StudentFeedback.propTypes = {
     responseId: PropTypes.number.isRequired,
     onSubmit: PropTypes.func.isRequired,
   };
   
   export default StudentFeedback;
   ```

### Testing

#### Backend Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_mentor_service.py -v

# Run tests matching pattern
pytest -k "test_adaptive" -v
```

#### Frontend Testing

```bash
cd frontend

# Run tests (if configured)
npm test

# Lint code
npm run lint

# Build for production
npm run build
```

### Commit Messages

Follow the Conventional Commits format:

```
type(scope): subject

body

footer
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring without feature changes
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build, dependency updates, etc.

**Examples:**
```
feat(mentor): add Socratic question generation

Implement new algorithm for generating Socratic questions
based on student weakness scores and learning goals.

Closes #123
```

```
fix(adaptive): correct difficulty calculation algorithm

The exponential moving average was incorrectly weighted.
Changed formula to match research paper specifications.
```

```
docs(readme): update installation instructions

Add Python 3.11 compatibility notes and improve clarity
of Redis setup instructions.
```

### Creating a Pull Request

1. **Push your changes**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** with:
   - Clear title describing the changes
   - Description of what was changed and why
   - Reference to related issues (#123)
   - Screenshots for UI changes
   - Test results

3. **PR Template**:
   ```markdown
   ## Description
   Brief description of the changes
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   
   ## Related Issues
   Closes #issue_number
   
   ## Testing
   - [ ] Tested locally
   - [ ] All tests pass
   - [ ] Added new tests
   
   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Documentation updated
   - [ ] No breaking changes
   - [ ] Backward compatible
   ```

### Code Review Process

1. **Two reviewers** will review your PR
2. **Address feedback** by making requested changes
3. **Request re-review** after making changes
4. **Merge** once approved by reviewers

## 📚 Development Setup

### Backend Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt
pip install black pylint mypy pytest

# Setup pre-commit hooks (optional)
pip install pre-commit
pre-commit install
```

### Frontend Development

```bash
cd frontend
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

### Database Development

```bash
# Reset database for testing
python -c "from app.database import init_db; init_db()"

# Use in-memory database for tests
export DATABASE_URL=sqlite:///:memory:
```

## 🎓 Architecture Guidelines

### Backend Structure

```
app/
├── routes/          # HTTP endpoints organized by feature
├── services/        # Business logic, no HTTP concerns
├── models/          # SQLAlchemy ORM models
├── schemas/         # Pydantic validation schemas
├── utils/           # Helper utilities
└── audio_interview/ # Audio-specific modules
```

**Principle**: Keep routes thin, put logic in services.

### Frontend Structure

```
src/
├── pages/      # Full page components
├── components/ # Reusable components
├── hooks/      # Custom React hooks
├── services/   # API and utility functions
└── styles/     # CSS files
```

**Principle**: Small, focused components with single responsibility.

## 🔐 Security Considerations

- **Never commit secrets**: Use `.env` files, never hardcode API keys
- **Validate input**: Always validate user input on both frontend and backend
- **Sanitize output**: Escape user-generated content
- **Use HTTPS**: Always use HTTPS in production
- **Keep dependencies updated**: Regularly run `pip audit` and `npm audit`

## 📝 Documentation Standards

### Docstring Format (Python)

```python
def function_name(param1: str, param2: int) -> dict:
    """
    Brief description of what the function does.
    
    Longer description if needed, explaining the algorithm
    or important implementation details.
    
    Args:
        param1: Description of param1
        param2: Description of param2
    
    Returns:
        Description of return value
        
    Raises:
        ValueError: When param2 is negative
        TypeError: When param1 is not a string
    
    Example:
        >>> result = function_name("test", 42)
        >>> result['success']
        True
    """
    pass
```

### JSDoc Format (JavaScript)

```javascript
/**
 * Calculates the next learning difficulty for a student.
 * 
 * @param {Object} student - Student object
 * @param {number} student.id - Student ID
 * @param {Array} student.feedbackHistory - Recent feedback
 * @param {Object} options - Configuration options
 * @param {number} options.maxDifficulty - Maximum difficulty level
 * @returns {number} Next difficulty level (1-10)
 * @throws {Error} If student data is invalid
 */
function calculateNextDifficulty(student, options = {}) {
  // Implementation
}
```

## 🚀 Performance Guidelines

### Backend
- Use database indexes for frequently queried fields
- Cache LLM responses when appropriate
- Implement pagination for large result sets
- Use async/await for I/O operations
- Monitor API response times

### Frontend
- Lazy load components
- Optimize bundle size
- Use React.memo for expensive components
- Debounce API calls
- Cache API responses appropriately

## 🔄 Workflow Example

```bash
# 1. Create feature branch
git checkout -b feature/add-admin-dashboard

# 2. Make changes and commit
git add app/routes/admin.py
git commit -m "feat(admin): add admin dashboard with user management"

# 3. Run tests
pytest
npm test

# 4. Format code
black app/
npm run format

# 5. Push changes
git push origin feature/add-admin-dashboard

# 6. Create Pull Request on GitHub
# (Visit GitHub and click "Compare & pull request")

# 7. Address review comments
git add .
git commit -m "refactor: address review comments"
git push

# 8. After approval, delete branch
git branch -d feature/add-admin-dashboard
git push origin --delete feature/add-admin-dashboard
```

## 📞 Getting Help

- **Questions**: Use GitHub Discussions
- **Issues**: Search existing issues first
- **Chat**: Join our community channels
- **Documentation**: Check ARCHITECTURE.md and DEVELOPER_REFERENCE.md

## 🎯 What We're Looking For

- Bug fixes that improve stability
- Performance improvements
- New features aligned with project vision
- Documentation improvements
- Test coverage expansion
- Code quality improvements
- Accessibility enhancements

## ⚠️ Before You Submit

**Checklist:**
- [ ] Code follows project style guide
- [ ] All tests pass locally
- [ ] No console warnings or errors
- [ ] Documentation is updated
- [ ] Commit messages are clear
- [ ] No breaking changes (or documented)
- [ ] Screenshots added for UI changes
- [ ] Related issues referenced

## 📖 Useful Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [SQLAlchemy ORM Tutorial](https://docs.sqlalchemy.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Python PEP 8](https://pep8.org/)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- GitHub contributors page

---

Thank you for contributing to Mentor AI! 🎉

Your efforts help improve education technology for everyone.
