# Codes

- **1xxxxx**: Information
  - **10xxxx**: Special
  - **11xxxx**: Generic
  - **12xxxx**: Server
  - **13xxxx**: Request
- **2xxxxx**: Error
  - **20xxxx**: Special
  - **21xxxx**: Generic
  - **22xxxx**: Server
  - **23xxxx**: Request
    - `230000`: `error` | `An error occurred while trying to process the request.`
    - `230001`: `endpoint_not_found` | `Endpoint not found.`
    - `230002`: `endpoint_method_not_found` | `Method not found for the current endpoint.`
- **3xxxxx**: Success
  - **30xxxx**: Special
  - **31xxxx**: Generic
  - **32xxxx**: Server
  - **33xxxx**: Request
