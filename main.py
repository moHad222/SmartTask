from server import SmartTaskHandler
from http.server import HTTPServer
import os


PORT = int(os.environ.get("PORT", 8000))


server = HTTPServer(
    ("0.0.0.0", PORT),
    SmartTaskHandler
)


print(f"SmartTask3 running on port {PORT}")


try:
    server.serve_forever()

except KeyboardInterrupt:
    print("Server stopped.")

finally:
    server.server_close()