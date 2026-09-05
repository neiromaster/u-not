# Contributing to u-not

Thank you for your interest in contributing! Here's how you can help improve the project.

## Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/neiromaster/u-not.git
   cd u-not
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Build and test**:
   ```bash
   bun run lint
   bun run typecheck
   bun run src/index.ts
   ```

## Code Structure

- `src/core/` - Core application logic
- `src/services/` - External service integrations
- `tests/` - Test files

## Branch Strategy

- `main` - Production code
- `develop` - Development branch
- Feature branches: `feature/xxx`, `fix/xxx`

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation updates
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/updates

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Submit a pull request to `develop`

## Code Review

All submissions are reviewed by maintainers. Be prepared for:

- Architecture discussions
- Testing requirements
- Documentation standards

## Issues

- Use the issue template
- Provide reproduction steps
- Include environment details

## Documentation

Update documentation when:

- Adding new features
- Changing API
- Fixing bugs (if it affects usage)

## Testing

Write tests for:

- New features
- Bug fixes
- Edge cases
- Integration scenarios

## Architecture Decisions

For significant changes, create an ADR (Architecture Decision Record) in `docs/adr/`.

## Support

- GitHub Issues for bugs
- Discussions for questions
- Email for sensitive matters