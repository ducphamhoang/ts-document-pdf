### **Code Guidelines for AI Agent: File Conversion API**

Here is a set of comprehensive guidelines to ensure the AI agent develops a clean, simple, and robust File Conversion API using Node.js, TypeScript, and a Clean Architecture approach.

---

### **1. Guiding Principles**

*   **Simplicity and Clarity:** Code should be easy to read and understand. Avoid overly complex abstractions or clever tricks.
*   **Single Responsibility Principle (SRP):** Each class, function, and module should have one, and only one, reason to change.
*   **Dependency Inversion:** High-level modules should not depend on low-level modules. Both should depend on abstractions.
*   **Security First:** All code must be written with security in mind, especially when handling file uploads and external processes.

### **2. Project Structure (Clean Architecture)**

The project will be organized into distinct layers to separate concerns. This structure makes the application maintainable, scalable, and easy to test.

```
/src
├── 📂 domain
│   └── 📄 file.entity.ts         # Core business objects and their logic
├── 📂 application
│   ├── 📂 use-cases
│   │   ├── 📄 convert-file.use-case.ts
│   │   └── 📄 get-converted-file.use-case.ts
│   └── 📂 interfaces
│       ├── 📄 file-converter.interface.ts # Abstraction for the conversion tool
│       └── 📄 storage.interface.ts      # Abstraction for file storage
├── 📂 infrastructure
│   ├── 📂 services
│   │   ├── 📄 libre-office.converter.ts # Implementation of IFileConverter
│   │   └── 📄 temporary-file.storage.ts # Implementation of IStorage
│   └── 📂 config
│       ├── 📄 index.ts                  # Environment variable handling
│       └── 📄 multer.config.ts          # Multer configuration
├── 📂 presentation
│   ├── 📂 controllers
│   │   └── 📄 file.controller.ts        # Handles HTTP requests and responses
│   ├── 📂 routes
│   │   └── 📄 file.routes.ts            # Defines API endpoints
│   ├── 📂 middleware
│   │   └── 📄 error.middleware.ts       # Centralized error handler
│   └── 📄 server.ts                     # Express server setup
└── 📄 index.ts                        # Application entry point
```

### **3. TypeScript Best Practices**

*   **Strict Mode:** Enable `strict: true` in `tsconfig.json` to enforce strong typing.
*   **Type Everything:** Avoid the `any` type. Use interfaces and types to define the shape of objects, function parameters, and return values.
*   **Use Interfaces for Abstractions:** Define interfaces in the `application` layer for dependencies like file converters and storage. This allows for easy swapping of implementations (e.g., from local storage to a cloud bucket).
*   **Readonly Properties:** Use the `readonly` modifier for properties that should not be changed after initialization.
*   **Naming Conventions:**
    *   **Classes & Interfaces:** `UpperCamelCase` (e.g., `FileController`).
    *   **Variables & Functions:** `lowerCamelCase` (e.g., `convertFile`).
    *   **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_FILE_SIZE`).
*   **ES Modules:** Use ES6 `import`/`export` syntax.

### **4. API Design & Implementation (Express.js)**

*   **Routing:** Define all routes in the `presentation/routes` directory. Keep route handlers in `presentation/controllers` thin. Their only job is to parse the request, call the appropriate use case, and format the response.
*   **Request Validation:** Do not trust user input. Use a validation library (like `express-validator` or `zod`) to validate incoming request bodies, params, and queries. For this project, validation should check for file presence, allowed MIME types, and file size limits.
*   **Middleware:**
    *   Use middleware for cross-cutting concerns like logging, security headers (`helmet`), and CORS.
    *   Each middleware function must have a single, focused responsibility.
    *   Asynchronous middleware must use `async/await` within a `try/catch` block, passing errors to `next()`.
*   **Consistent Responses:** Return predictable JSON responses for both success and error cases.
    *   **Success:** `res.status(200).json({ success: true, data: { ... } });`
    *   **Error:** `res.status(statusCode).json({ success: false, error: { message: '...' } });`

### **5. Error Handling**

*   **Centralized Error Handling:** All errors should be caught and passed to a single, centralized error-handling middleware function defined at the end of the middleware stack in `server.ts`.
*   **Custom Error Classes:** Create custom error classes that extend the base `Error` class for different types of operational errors (e.g., `ValidationError`, `UnsupportedFileTypeError`, `ConversionFailedError`). This makes error handling logic cleaner.
*   **Distinguish Error Types:** Differentiate between operational errors (e.g., invalid user input) and programmer errors (bugs). Operational errors should result in a meaningful HTTP error response. Programmer errors should crash the application, and a process manager like PM2 should handle the restart.

### **6. File Handling and Security**

*   **Use `multer` for Uploads:** Configure `multer` to handle `multipart/form-data`.
*   **Temporary Storage:**
    *   Use the operating system's temporary directory (`os.tmpdir()`) for initial uploads.
    *   Generate unique, random filenames for stored files to prevent path traversal and collision attacks. The `fs.mkdtemp` function is ideal for this.
*   **Strict File Validation:**
    *   **File Type:** Validate the file's MIME type on the server. Do not trust the `Content-Type` header alone or the file extension. Use libraries that can inspect file magic numbers if higher security is needed.
    *   **File Size:** Set a strict file size limit in the `multer` configuration to prevent Denial of Service (DoS) attacks.
*   **LibreOffice CLI Interaction:**
    *   Execute the `libreoffice` command using Node.js's `child_process.execFile` or `spawn` for better security and control over arguments. Avoid `exec` which is vulnerable to shell injection.
    *   Wrap the CLI interaction in a dedicated service within the `infrastructure` layer.
    *   Set a timeout for the conversion process to prevent long-running processes from blocking the server.
*   **Cleanup:** Always clean up temporary files. Use a `try...finally` block to ensure that the uploaded file and the converted PDF are deleted, even if an error occurs during conversion.

### **7. Dependencies and Configuration**

*   **Dependency Injection (DI):** While full DI containers like `tsyringe` are an option, for this simple project, use constructor-based injection manually. Pass instances of infrastructure services (like the converter and storage) to the use case classes when you instantiate them. This maintains decoupling and improves testability.
*   **Environment Variables:** Do not hardcode configuration values (e.g., port, max file size, temp directory path). Use a library like `dotenv` to load these from a `.env` file for development and from system environment variables in production. Create a central config file (`infrastructure/config/index.ts`) to export these values.

---

By adhering to these guidelines, the AI agent will produce a high-quality, secure, and maintainable API that follows established software engineering best practices.