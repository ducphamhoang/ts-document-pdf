### **Product Requirements Document: Text Translation API**

**Author:** Gemini
**Date:** October 16, 2025

---

### **1. Introduction**

This document outlines the product requirements for a new Text Translation API. This service will provide a simple and efficient way to translate batches of text from a specified source language to a target language. The API will accept a JSON payload containing text items, process them using a generative AI model (e.g., Gemini 2.5 Flash), and return the translated text while preserving the original structure and identifiers. This service is intended for applications that need to integrate multilingual capabilities by translating text content programmatically.

### **2. Goals and Objectives**

*   **Primary Goal:** To provide a reliable and fast API for translating text snippets in batches.
*   **Key Objectives:**
    *   Develop a secure and stable API endpoint for receiving text translation requests.
    *   Ensure accurate translation by integrating with a powerful generative AI model.
    *   Return translated data in a predictable format that mirrors the request structure.
    *   Implement robust error handling for failed translation jobs.
    *   Ensure the API is scalable and can handle a reasonable load of concurrent requests.

### **3. Use Cases**

**Use Case 1: Successful Text Translation**

1.  **User:** A client application.
2.  **Action:** The user sends a POST request to the `/translate` endpoint with a JSON body containing `sourceLanguage`, `targetLanguage`, and an array of `items` to be translated.
3.  **System Response:**
    *   The API receives and validates the JSON payload.
    *   The system iterates through the text items and sends them to the translation service.
    *   The API responds with a 200 OK and a JSON object containing the translated text for each item, maintaining the original `id` and `position` data.

**Use Case 2: Failed Text Translation**

1.  **User:** A client application.
2.  **Action:** The user sends a POST request to the `/translate` endpoint, but the translation service fails for one or more items (e.g., due to an invalid language code or an internal service error).
3.  **System Response:**
    *   The API detects the failure from the translation service.
    *   The API responds with an appropriate error code (e.g., 500 or 422) and a JSON object detailing the error, ensuring that no partial data is returned.

### **4. Edge Cases and Error Handling**

| **Edge Case** | **System Handling** | **API Response** |
| :--- | :--- | :--- |
| **Invalid or Missing Language** | The API will validate `sourceLanguage` and `targetLanguage` fields. | `400 Bad Request` with a descriptive error message. |
| **Payload Too Large** | The API will enforce a token limit on the total text content (e.g., 10,000 tokens). | `413 Payload Too Large` if the text content exceeds the limit. |
| **Translation Service Failure** | If the external translation service fails for any reason. | `503 Service Unavailable` or `422 Unprocessable Entity` with an error message indicating a translation failure. |
| **Empty `items` Array** | If the POST request contains an empty `items` array. | `400 Bad Request` with a message stating that `items` cannot be empty. |
| **Invalid JSON format** | If the request body is not valid JSON. | `400 Bad Request` with a JSON parsing error message. |

### **5. Architecture**

The new translation feature will be integrated into the existing Clean Architecture:

*   **Presentation Layer:** A new `TranslationController` and `translation.routes.ts` will be created to handle `/api/v1/translate` requests. DTOs for the request and response will be defined.
*   **Application Layer:** A new `TranslateTextUseCase` will be created. This use case will orchestrate the validation and translation process, calling the necessary services from the infrastructure layer.
*   **Domain Layer:** New entities or value objects for `TranslationJob` and `TranslatedText` might be introduced if the logic becomes complex, but for now, existing domain principles will be applied.
*   **Infrastructure Layer:** A new service, `TranslationService`, will be implemented. This service will be responsible for communicating with the external generative AI API (e.g., Google's Gemini).

### **6. API Specification**

**Endpoint:** `/api/v1/translate`

*   **Method:** `POST`
*   **Description:** Translates a batch of text items from a source language to a target language.
*   **Request:**
    *   **Headers:** `Content-Type: application/json`
    *   **Body:**
    ```json
    {
      "sourceLanguage": "en-US",
      "targetLanguage": "fr-FR",
      "items": [
        {
          "id": "item-1",
          "text": "Hello, world!",
          "position": { "page": 1, "x": 100, "y": 200 }
        },
        {
          "id": "item-2",
          "text": "This is a test.",
          "position": { "page": 1, "x": 100, "y": 250 }
        }
      ]
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Text translated successfully.",
      "data": [
        {
          "id": "item-1",
          "text": "Bonjour, le monde!",
          "position": { "page": 1, "x": 100, "y": 200 }
        },
        {
          "id": "item-2",
          "text": "Ceci est un test.",
          "position": { "page": 1, "x": 100, "y": 250 }
        }
      ]
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`
    *   `413 Payload Too Large`
    *   `422 Unprocessable Entity`
    *   `503 Service Unavailable`

### **7. Non-Functional Requirements**

*   **Performance:** The API should process and translate a standard request of 10 items (approx. 1000 tokens) in under 3 seconds.
*   **Security:**
    *   Input text should be sanitized to prevent injection attacks, although the risk is low as the text is passed to an external service and not a database.
    *   No authentication is required for the initial version.
*   **Scalability:** The architecture should allow for future scaling, potentially by using a more robust queueing system if translation times increase.
*   **Logging:** The application should log key events, including successful translations and errors, along with request identifiers for traceability.

### **8. Assumptions and Dependencies**

*   **Generative AI Service:** It is assumed that we will have access to a generative AI service like Google Gemini via an API key.
*   **API Key Management:** The API key for the translation service must be stored securely and not exposed in the codebase.
*   **Environment:** The application will continue to be built using Node.js with TypeScript.
