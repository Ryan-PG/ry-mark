# Project Implementation Prompt: MD Renderer

You are a senior software architect, frontend engineer, UI/UX designer, and Cloudflare developer.

Your task is to design and implement a production-ready, modern Markdown and HTML viewer that can be deployed to Cloudflare Pages.

Do not deliver a basic Markdown viewer with a generic sidebar and plain typography. The goal is to build a polished documentation platform with a strong visual identity, excellent reading experience, and maintainable architecture.

You have ownership of the implementation details, but you must respect every requirement in this specification.

---

# 1. Project Overview

Build a web application that reads Markdown and HTML files from a predefined directory structure and displays them in a documentation-style interface.

The application must:

- Run on Cloudflare Pages.
- Be primarily client-side.
- Require no database.
- Have no conventional backend or business API.
- Use Cloudflare Pages Functions only for authentication and protected content delivery where necessary.
- Support nested directories.
- Automatically generate navigation from the content directory.
- Render Markdown files into HTML using a replaceable Markdown rendering engine.
- Display HTML files as actual HTML documents without converting them into Markdown.
- Have password protection using Cloudflare Secrets.
- Support multiple simultaneous users with one shared password.
- Have no content editing functionality.
- Be deployable automatically through GitHub integration.

The application is read-only.

Do not implement an editor, upload system, content management panel, or database.

# 2. Mandatory Initial Tasks: Research and Skills

Before implementing the UI, inspect the project environment and available tools.

## 2.1 UI/UX Skills

You MUST actively search for suitable UI development skills before designing the interface.

Look for relevant skills such as:

- Frontend Design
- UI/UX Design
- shadcn/ui
- Tailwind CSS
- Modern React Design
- Accessibility
- Responsive Web Design

Use an available skill marketplace or the skill installation mechanism supported by your environment.

Do not assume that mentioning a skill is equivalent to learning it.

For every relevant skill:

1. Find the skill.
2. Read its SKILL.md file.
3. Read relevant supporting references.
4. Apply its recommendations during implementation.

Prefer established, reputable skills and avoid installing unknown tools without inspecting their contents.

If a suitable skill is already installed, reuse it.

## 2.2 Technical Research

Before selecting implementation details, inspect the latest official documentation for:

- Cloudflare Pages.
- Cloudflare Pages Functions.
- Cloudflare Secrets.
- Cloudflare Workers Web Crypto.
- React.
- Vite.
- React Markdown.
- remark and rehype.
- Tailwind CSS.
- shadcn/ui.

Verify Cloudflare compatibility for every runtime dependency.

Do not assume that a package working in Node.js automatically works inside Cloudflare Workers.

Document important architectural decisions.

# 3. Project Documentation and Agent Instructions

Create the necessary project documentation before or during initial implementation.

At minimum, create:

```text
AGENTS.md
README.md
PROJECT-SPECIFICATION.md
ARCHITECTURE.md
PROGRESS.md
CHANGELOG.md
SECURITY.md
docs/
├── AUTHENTICATION.md
├── PASSWORD-SETUP.md
├── DEPLOYMENT.md
├── MARKDOWN-RENDERING.md
├── CONTENT-STRUCTURE.md
└── UI-DESIGN.md
```

You may add other files when they are useful.

## AGENTS.md

This file is mandatory.

It must contain:

- Project architecture.
- Technology stack.
- Coding conventions.
- Security requirements.
- File organization rules.
- Testing requirements.
- Deployment rules.
- Important architectural constraints.
- Instructions for future AI agents.

Future agents must read AGENTS.md before modifying the project.

All code comments MUST be written in English.

## PROGRESS.md

This file must be maintained throughout development.

Track:

- Completed tasks.
- Currently active tasks.
- Pending tasks.
- Known issues.
- Technical decisions.
- Testing status.
- Deployment readiness.

Update this file whenever a meaningful task is completed.

Do not mark a feature as completed before implementing and testing it.

## PROJECT-SPECIFICATION.md

Maintain the actual product requirements and expected behavior here.

Keep it synchronized with the implementation.

## Documentation quality

Do not create empty placeholder documents.

Every document must contain useful and accurate information.

# 4. Technology Stack

Use the following stack unless technical research identifies a genuine compatibility issue.

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui

### Markdown Rendering

Use `react-markdown` as the initial Markdown rendering implementation.

Recommended ecosystem:

- react-markdown
- remark-gfm
- remark-math
- remark-directive
- rehype-katex
- rehype-slug
- rehype-autolink-headings
- rehype-sanitize
- Shiki for syntax highlighting
- Mermaid for diagrams

You do not need to install unnecessary packages.

Choose stable versions and verify compatibility.

### Cloudflare

- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare Runtime Secrets
- Cloudflare Web Crypto API
- Wrangler for local development and testing

Avoid introducing unnecessary infrastructure.

# 5. Critical Architecture Requirement: Replaceable Markdown Renderer

This is one of the most important requirements.

Do NOT couple the entire application directly to react-markdown.

The Markdown rendering engine must be replaceable without requiring modifications to the rest of the application.

Create a dedicated rendering abstraction.

For example:

```text
src/
└── features/
    └── document-rendering/
        ├── core/
        │   ├── types.ts
        │   ├── renderer-registry.ts
        │   └── renderer-adapter.ts
        ├── engines/
        │   └── react-markdown/
        │       ├── ReactMarkdownRenderer.tsx
        │       ├── plugins.ts
        │       └── components.tsx
        ├── components/
        │   ├── MarkdownDocument.tsx
        │   ├── HtmlDocument.tsx
        │   └── DocumentViewer.tsx
        └── index.ts
```

This is an example, not a mandatory exact structure.

Define a stable renderer interface.

The application should interact with the renderer through this abstraction rather than importing react-markdown throughout the application.

The renderer abstraction should support:

- Rendering Markdown.
- Custom component mapping.
- Rendering configuration.
- Error handling.
- Future engine replacement.

The initial implementation must use react-markdown.

If a different Markdown engine is selected in the future, only the rendering implementation and its adapter should need modification.

The Sidebar, Navigation, Content Loader, and application layout must remain independent of the selected renderer.

Keep HTML document rendering independent from Markdown rendering.

# 6. Content Directory and Navigation

Create a dedicated directory:

```text
content/
```

This directory is the source of truth for all documents.

Example:

```text
content/
├── README.md
├── Engineering/
│   ├── Architecture.md
│   ├── Diagrams.html
│   └── Backend/
│       ├── API.md
│       ├── Database.md
│       └── Schema.html
├── Tutorials/
│   ├── Docker.md
│   ├── Linux.md
│   └── Advanced/
│       └── Networking.html
└── Resources/
    └── images/
        └── architecture.png
```

Requirements:

1. Any number of nested directories must be supported.
2. Every directory must be represented in the navigation.
3. Markdown files must appear as navigation items.
4. HTML files must appear as navigation items.
5. Assets such as images must be available to documents but must not automatically become navigation items.
6. Navigation must be generated automatically.
7. Adding, removing, or renaming a file must update the generated navigation on the next build.
8. Do not require manually editing a navigation configuration for every document.

## Manifest Generation

Implement a build-time script that scans `content/` and generates a manifest.

The manifest must contain:

- Directory hierarchy.
- File names.
- File types.
- Relative paths.
- Stable navigation identifiers where appropriate.
- Metadata needed by the frontend.

Do not depend on browser filesystem access.

Browsers cannot directly enumerate directories on the deployed server.

The manifest generator must run automatically before Vite builds the application.

Use a secure and deterministic path-generation strategy.

Prevent path traversal.

Do not expose filesystem paths outside the content root.

# 7. Document Rendering Behavior

There are two distinct document types.

They MUST have different rendering paths.

## 7.1 Markdown Files

For `.md` files:

1. Load the Markdown source.
2. Pass it to the currently selected Markdown renderer.
3. Convert it into a rendered document.
4. Display it inside the main content pane.

The Markdown renderer should support:

- Headings.
- Paragraphs.
- Bold and italic text.
- Ordered and unordered lists.
- Nested lists.
- Tables.
- Task lists.
- Blockquotes.
- Links.
- Images.
- Inline code.
- Code blocks.
- Syntax highlighting.
- Copy code button.
- Mathematical formulas using KaTeX.
- Mermaid diagrams.
- Heading anchors.
- Automatic table of contents.
- Callouts and alerts.
- Custom components.
- Horizontal rules.
- Strikethrough.

Use remark-gfm for GitHub Flavored Markdown.

Implement reusable React components for document elements.

At minimum, create:

- Note
- Info
- Warning
- Danger
- Success
- CodeBlock
- Tabs
- Cards
- Badge
- FileTree

Use a consistent visual design for all these components.

Custom Markdown directives should be documented with examples.

Raw HTML inside Markdown must be disabled by default.

Do not enable unrestricted raw HTML rendering.

If HTML inside Markdown is ever supported, it must pass through a carefully configured sanitizer.

## 7.2 HTML Files

For `.html` files:

DO NOT parse them as Markdown.

DO NOT convert them into React components.

DO NOT sanitize them and then attempt to reconstruct their original structure.

Display the actual HTML document directly inside an isolated iframe.

Important requirements:

- Preserve the original HTML structure.
- Preserve CSS.
- Preserve JavaScript behavior where permitted.
- Preserve images.
- Preserve relative asset paths.
- Preserve external stylesheets.
- Preserve document metadata.
- Preserve the original page layout.

The HTML file should be loaded from its actual content URL so relative paths work correctly.

Use an iframe with an appropriate sandbox policy.

Do not grant unnecessary permissions such as unrestricted same-origin access.

If an HTML document needs additional permissions, document and justify them.

HTML documents are trusted project content, but they must still be isolated from the main application and its authentication cookies.

Do not accidentally expose authentication tokens to embedded HTML.

## 7.3 Document Viewer

Create a dedicated document viewer that selects the correct renderer based on the file extension.

Conceptually:

```text
DocumentViewer
    |
    ├── .md
    |     |
    |     └── MarkdownRendererAdapter
    |
    └── .html
          |
          └── IsolatedHtmlIframe
```

The rest of the application must not need to know how each document is rendered.

# 8. UI/UX Requirements

This is not a basic tutorial project.

The UI must look like a polished modern documentation product.

Do not deliver a generic interface consisting of a plain sidebar, a white page, and default HTML typography.

Study modern documentation interfaces for inspiration, but do not blindly copy an existing product.

Possible design references:

- VitePress
- Mintlify
- GitBook
- Linear
- Stripe Documentation
- Tailwind CSS Documentation

## Main Layout

Use a professional documentation layout with:

### Left Sidebar

- Application logo or name.
- Search input or search trigger.
- Hierarchical directory navigation.
- Expandable and collapsible folders.
- Clear selected document state.
- Icons for folders, Markdown, and HTML.
- Smooth navigation.
- Scrollable navigation.
- Responsive behavior.

### Main Content Pane

- Document title.
- Breadcrumb navigation.
- Document content.
- Proper content width.
- Excellent typography.
- Readable code blocks.
- Responsive tables.
- Consistent spacing.
- Appropriate document loading and error states.

### Optional Right Sidebar

A contextual table of contents generated from Markdown headings.

It should be hidden when it is not useful or when screen space is limited.

### Header

Include:

- Application identity.
- Breadcrumbs.
- Theme toggle.
- Search functionality.
- Sidebar controls where appropriate.

Do not overcrowd the header.

## Visual Design

Requirements:

- Modern and clean.
- Professional typography.
- Excellent spacing.
- Carefully selected colors.
- Consistent component styling.
- Subtle transitions.
- Good contrast.
- Beautiful dark mode.
- Beautiful light mode.
- Responsive layouts.
- Proper empty states.
- Proper loading states.
- Proper error states.

Avoid:

- Excessive gradients.
- Unnecessary animations.
- Too many borders.
- Oversized headings.
- Generic dashboard layouts.
- Random decorative icons.
- Inconsistent component styles.
- Excessive use of cards.

The final result must look intentionally designed.

## Design System

Create a consistent design system with:

- Color tokens.
- Typography scale.
- Spacing scale.
- Border radius tokens.
- Shadows.
- Component variants.
- Dark/light themes.

Use shadcn/ui components where appropriate.

Customize them instead of accepting default styles blindly.

## Responsive Design

Support:

- Desktop.
- Laptop.
- Tablet.
- Mobile.

On mobile, the sidebar should become a drawer or an equivalent navigation panel.

The document must remain readable without horizontal overflow except where required, such as wide code blocks or tables.

## Accessibility

Support:

- Keyboard navigation.
- Visible focus indicators.
- Appropriate ARIA attributes.
- Semantic HTML.
- Sufficient color contrast.
- Screen reader-friendly navigation.

# 9. Search

Implement client-side document search.

Search should work without a backend.

Requirements:

- Search document titles.
- Search document content where feasible.
- Show matching results.
- Allow keyboard navigation.
- Highlight matching terms where appropriate.
- Navigate directly to the selected document.

Build the search index during the build process.

Do not expose any content that is not already protected by the authentication layer.

# 10. Authentication and Cloudflare Secrets

This is a critical security requirement.

The application must support one shared password for all users.

No individual user accounts are needed.

Multiple users must be able to log in simultaneously with the same password.

## 10.1 Cloudflare Secrets

Use the following runtime Secrets:

```text
PASSWORD_HASH
SESSION_SECRET
```

Both must be configured as encrypted Cloudflare Secrets.

Never expose either value to the frontend.

Never place secrets in:

- Vite environment variables.
- Client-side JavaScript.
- HTML.
- Public configuration files.
- Git.
- Build artifacts.
- Browser responses.

Access secrets only through the Cloudflare Pages Functions runtime environment.

## 10.2 Password Hashing

Implement a secure password hashing workflow.

Important technical constraint:

Cloudflare Workers Web Crypto does not provide native Argon2id support. Do not assume a Node.js Argon2 package will work inside Cloudflare Pages Functions.

Evaluate compatible password hashing algorithms and their actual runtime performance.

Prefer a well-established password KDF.

Requirements:

- Unique random salt.
- Configurable and documented work factor.
- Versioned hash format.
- Constant-time comparison where applicable.
- No plaintext password storage.
- No plaintext password logging.
- No hardcoded password.
- No client-side verification.

Benchmark the verification process against the actual Cloudflare Workers runtime and its CPU limits, including the Free plan.

Do not silently weaken password hashing to make an implementation fit within an arbitrary CPU limit.

If the desired password KDF cannot run securely and reliably within the selected Cloudflare plan, document the limitation and propose a secure alternative, such as Cloudflare Access or a suitable paid runtime configuration.

The final selected algorithm and parameters must be explicitly documented.

The password generation script and runtime verifier must use exactly the same format and parameters.

## 10.3 Password Generation Script

Provide a command:

```bash
npm run hash:password
```

It must:

1. Prompt the administrator for a password.
2. Avoid echoing the password in the terminal where possible.
3. Generate a cryptographically secure random salt.
4. Produce the exact hash format expected by the runtime verifier.
5. Print only the resulting hash.
6. Never save the plaintext password.
7. Never write the hash into a committed project file.

The command must work on Windows, Linux, and macOS.

Do not require users to manually write or modify source code to generate the hash.

## 10.4 Session Management

After successful authentication:

- Create a cryptographically signed session.
- Use `SESSION_SECRET` for HMAC signing.
- Use Web Crypto APIs supported by Cloudflare Workers.
- Store the session in a secure cookie.
- Set `HttpOnly`.
- Set `Secure`.
- Set an appropriate `SameSite` policy.
- Set `Path=/`.
- Set an expiration time.
- Validate expiration on every protected request.

Use a reasonable session lifetime, documented in the project.

Each browser must receive an independent session.

Logging out one user must not log out other users.

Changing `SESSION_SECRET` must invalidate previously issued sessions.

Do not use localStorage for authentication tokens.

## 10.5 Authentication Endpoints

Implement only the necessary authentication functionality.

For example:

```text
GET  /api/auth/status
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
```

These are infrastructure endpoints, not a general-purpose business API.

Implement proper request validation and security headers.

Login requests must be protected against brute-force attempts using a suitable Cloudflare-compatible rate-limiting approach.

Do not pretend that an in-memory rate limiter is globally reliable across Cloudflare isolates.

## 10.6 Missing or Invalid Secret Behavior

This requirement is especially important.

Authentication must be enabled by default.

The application must fail closed.

If `PASSWORD_HASH` is missing:

- Do NOT display the login form.
- Do NOT allow access to any content.
- Do NOT treat the application as public.
- Display a dedicated configuration/setup screen.
- Explain that the administrator must generate a password hash.
- Show the exact command to generate it.
- Explain where the resulting hash must be placed in Cloudflare.
- Provide a link or clear navigation instructions to the Cloudflare configuration documentation.

The setup screen must display something similar to:

```text
Password protection is not configured.

To enable access:

1. Run:

   npm run hash:password

2. Copy the generated hash.

3. Open your Cloudflare Pages project.

4. Navigate to:

   Settings > Variables and Secrets

5. Create an encrypted Secret named:

   PASSWORD_HASH

6. Paste the generated hash.

7. Create another encrypted Secret named:

   SESSION_SECRET

8. Save your settings and redeploy if required.

Refresh this page after configuration.
```

Adapt the instructions to the actual deployment setup and verify the current Cloudflare documentation.

If `PASSWORD_HASH` exists but is malformed or uses an unsupported format:

- Do NOT display the login form.
- Do NOT silently bypass authentication.
- Display a clear configuration error.
- Explain how to regenerate and replace the Secret.

Never reveal the configured hash or any secret value in the UI.

## 10.7 Authentication Must Protect Actual Content

Protecting only the login page is insufficient.

Every content request must be protected.

This includes:

- Markdown source files.
- HTML documents.
- Images.
- Assets.
- Manifest files.
- Search indexes.
- Other files under the content directory.

Unauthenticated users must not be able to retrieve content simply by opening a direct URL.

Inspect Cloudflare Pages routing behavior carefully.

Use the correct middleware and routing configuration so that static content cannot bypass authentication.

Verify direct URL access in an unauthenticated browser session.

The public application shell may load so that it can display the setup or login screen, but protected content must never be served without valid authentication.

Check both production and preview deployment behavior.

Preview deployments must fail closed if their authentication Secrets are missing.

## 10.8 Password Changes

Changing `PASSWORD_HASH` in Cloudflare must change the shared password without modifying source code.

Existing sessions may remain valid until expiration unless explicitly invalidated.

Document this behavior.

# 11. Cloudflare Deployment

The project must be designed for a simple Git-based deployment.

Use Cloudflare Pages with GitHub integration.

Expected deployment configuration:

```text
Framework: Vite
Build command: npm run build
Build output directory: dist
Production branch: main
```

The exact settings must be verified against the final implementation.

Cloudflare Pages Functions must be deployed as part of the same project.

There must not be a separately managed backend deployment.

Do not introduce an unnecessary database, server, Docker deployment, or external authentication service.

## Deployment Requirements

- Build automatically on Git push.
- Deploy frontend and Functions together.
- Preserve Cloudflare Secrets across subsequent builds.
- Keep production and preview environments clearly separated.
- Ensure no secret is bundled into frontend assets.
- Document first-time deployment.

A normal source-code update should not require resetting Secrets.

Provide local development instructions using Wrangler.

Do not commit real secrets.

Provide a safe `.dev.vars.example` or equivalent example containing placeholders only.

# 12. Security

Implement and document:

- Secure cookies.
- HMAC signature validation.
- Constant-time signature comparison where applicable.
- Password verification.
- Rate limiting.
- Content access protection.
- Path traversal prevention.
- HTML iframe isolation.
- Markdown sanitization.
- Safe external links.
- Appropriate Content Security Policy.
- Security headers.
- Safe error messages.
- No secret leakage in logs.

Use the minimum permissions necessary.

Do not expose the main application's authentication cookies to embedded HTML documents.

Never trust filenames or paths supplied by the browser.

# 13. Testing Requirements

Do not consider the project complete just because `npm run build` succeeds.

Implement meaningful tests.

At minimum:

### Content Tests

- Nested directories.
- Markdown discovery.
- HTML discovery.
- Asset discovery.
- Manifest generation.
- Unicode filenames.
- Spaces in filenames.
- Empty directories.
- Invalid paths.
- Missing documents.

### Markdown Tests

- Headings.
- Tables.
- Lists.
- Task lists.
- Code blocks.
- Math.
- Mermaid.
- Custom directives.
- Sanitization.
- Links and images.

### HTML Tests

- Direct HTML rendering.
- Relative CSS paths.
- Relative image paths.
- JavaScript behavior within the permitted iframe sandbox.
- Isolation from the main application.

### Authentication Tests

- Missing password hash.
- Malformed password hash.
- Correct password.
- Incorrect password.
- Expired session.
- Tampered session.
- Logout.
- Concurrent users.
- Missing session secret.
- Session secret rotation.
- Direct content URL access without authentication.
- Direct asset URL access without authentication.

### Deployment Tests

- Production build.
- Cloudflare Pages Functions compatibility.
- Local Wrangler development.
- Preview deployment configuration.
- Secret availability.
- No secret leakage in generated files.

Use appropriate testing tools such as Vitest and Playwright where useful.

# 14. Performance

The application should be lightweight and fast.

Requirements:

- Avoid unnecessary dependencies.
- Lazy-load large documents where appropriate.
- Avoid rendering the entire content collection at once.
- Optimize search indexing.
- Avoid unnecessary React re-renders.
- Lazy-load Mermaid when needed.
- Load KaTeX resources efficiently.
- Keep the initial application bundle reasonable.

The application should remain responsive with hundreds of documents.

# 15. Code Quality and Architecture

Use:

- TypeScript strict mode.
- Clear separation of responsibilities.
- Reusable components.
- Small and maintainable modules.
- Explicit interfaces.
- Consistent naming.
- Error boundaries where appropriate.
- Centralized configuration.
- Clear dependency boundaries.

Avoid:

- Giant React components.
- Duplicated rendering logic.
- Hardcoded content.
- Hardcoded secrets.
- Unnecessary abstractions.
- Premature complexity.
- Unnecessary state management libraries.

The Markdown engine must remain replaceable.

The HTML renderer must remain independent.

The authentication implementation must remain independent of the document rendering layer.

# 16. Git Rules

Do not perform any Git operation that changes repository history or remote state unless explicitly instructed.

In particular, do not:

- Commit.
- Push.
- Create branches.
- Switch branches.
- Reset.
- Rebase.
- Merge.
- Force push.
- Delete branches.
- Modify remote repository settings.

You may inspect Git status and repository history.

The final implementation must remain available in the working directory without an automatic commit.

# 17. Implementation Workflow

Follow this sequence.

## Phase 1: Inspection and Planning

- Inspect the repository.
- Inspect existing files.
- Identify available skills.
- Read relevant UI skills.
- Research official technical documentation.
- Identify Cloudflare constraints.
- Define the architecture.
- Create project documentation.
- Update PROGRESS.md.

Do not overwrite existing project files without inspecting them.

## Phase 2: Foundation

- Configure React and Vite.
- Configure TypeScript.
- Configure Tailwind CSS.
- Configure shadcn/ui.
- Establish the design system.
- Create the folder structure.
- Implement the content manifest generator.

## Phase 3: Document Rendering

- Implement the renderer abstraction.
- Implement the react-markdown adapter.
- Implement Markdown components.
- Implement HTML iframe rendering.
- Implement document loading.
- Implement navigation integration.

## Phase 4: UI Implementation

- Implement the complete documentation layout.
- Implement the Sidebar.
- Implement responsive navigation.
- Implement the document viewer.
- Implement breadcrumbs.
- Implement table of contents.
- Implement dark and light modes.
- Implement search.
- Refine typography and spacing.

Do not stop at a wireframe or basic prototype.

## Phase 5: Authentication

- Implement the password generation utility.
- Select and verify a Cloudflare-compatible password KDF.
- Implement password verification.
- Implement signed sessions.
- Implement login and logout.
- Implement missing-secret setup screen.
- Implement secure request protection.
- Verify direct URL protection.

## Phase 6: Testing and Hardening

- Add unit tests.
- Add integration tests.
- Add browser tests.
- Test Cloudflare compatibility.
- Test authentication failure scenarios.
- Inspect the final UI.
- Fix all critical issues.

## Phase 7: Documentation and Final Review

- Update README.md.
- Complete deployment documentation.
- Complete authentication documentation.
- Complete password setup documentation.
- Update AGENTS.md.
- Update PROGRESS.md.
- Record important decisions.
- Provide a final implementation report.

# 18. Definition of Done

The project is complete only when all of the following are true:

- [ ] Application builds successfully.
- [ ] Cloudflare Pages compatibility is verified.
- [ ] Git-based deployment is documented.
- [ ] Cloudflare Secrets are used correctly.
- [ ] Password generation command works.
- [ ] Password verification works.
- [ ] Missing Secret never exposes protected content.
- [ ] Missing Secret never displays the login form.
- [ ] Setup instructions are shown when authentication is not configured.
- [ ] Multiple users can log in simultaneously.
- [ ] Sessions are independently maintained.
- [ ] Logout works.
- [ ] Nested directories work.
- [ ] Navigation is generated automatically.
- [ ] Markdown documents render correctly.
- [ ] HTML documents are displayed as actual HTML.
- [ ] HTML and Markdown rendering are independent.
- [ ] Markdown rendering engine is replaceable.
- [ ] Search works.
- [ ] Dark mode works.
- [ ] Light mode works.
- [ ] Mobile layout works.
- [ ] UI is polished and professional.
- [ ] Security tests pass.
- [ ] Documentation is complete.
- [ ] PROGRESS.md accurately reflects the final status.

# 19. Final Instructions

Take responsibility for the entire implementation.

Do not stop after generating a project structure.

Do not stop after creating documentation.

Do not stop after building a basic UI.

Do not skip testing.

Make reasonable engineering decisions independently when requirements are clear.

If you encounter a genuine technical limitation, investigate it, document it, and choose the safest practical alternative. Do not silently ignore requirements or invent capabilities.

Do not claim that something works unless you have tested it.

Prioritize correctness, security, maintainability, and visual quality.

The final deliverable must be a working, polished, maintainable MD/HTML documentation viewer ready for Cloudflare Pages deployment.

IMPORTANT: The following requirements extend and refine the existing project specification. They are architectural requirements, not optional features. If any earlier requirement conflicts with these additions, reconcile the specification before implementation. Update all relevant architecture, authentication, deployment, security, testing, and documentation sections accordingly. Do not simply append these requirements to documentation; integrate them into the actual project architecture and implementation plan.

## Multi-Deployment & Authentication Configuration

Ry-Mark MUST support two first-class deployment targets from the beginning:

1. Cloudflare Pages
2. Self-hosted deployment using Node.js and Docker

### Authentication Toggle

Provide the following environment variable:

`AUTH_ENABLED=true`

Behavior:

- `true`: Authentication is required.
- `false`: Authentication is disabled and all content is publicly accessible.
- Missing or invalid value: Default to enabled (fail-closed).

When authentication is enabled, require:

- `PASSWORD_HASH`
- `SESSION_SECRET`

Never expose secrets to the frontend.

When authentication is disabled, password and session secrets are not required.

### Portable Authentication Architecture

Do not couple authentication business logic to Cloudflare Pages Functions.

Implement a shared authentication core responsible for:

- Password verification
- Session creation and validation
- Cookie generation and validation
- Session expiration
- Authorization decisions
- Authentication configuration validation

Implement separate deployment adapters:

**Cloudflare Adapter**

- Cloudflare Pages Functions
- Cloudflare environment bindings and encrypted secrets
- Middleware protecting all content and static assets

**Self-hosted Adapter**

- Node.js HTTP server
- Environment variables loaded from `.env`
- Same authentication core and session behavior
- Middleware protecting all content and static assets
- Production-ready Dockerfile and Docker Compose configuration

### Self-hosted Requirements

Users must be able to deploy Ry-Mark without creating a Cloudflare account.

Provide:

- Dockerfile
- docker-compose.yml
- .env.example
- Persistent configuration instructions
- Health check endpoint
- Production startup command
- Reverse proxy documentation for Nginx and Caddy
- HTTPS and secure-cookie requirements

The application must work without a database.

### Deployment Consistency

Both deployment targets must:

- Use the same frontend build.
- Use the same content manifest.
- Use the same Markdown renderer.
- Use the same authentication core.
- Enforce identical content access rules.
- Support AUTH_ENABLED consistently.
- Protect direct file URLs, HTML documents, images, assets, manifest and search index when authentication is enabled.

Do not duplicate authentication logic between deployment adapters.

Document both deployment methods independently in the README and deployment documentation.

Add automated tests that verify equivalent authentication behavior in both environments.
