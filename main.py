import os
from http.server import HTTPServer

from server import SmartTaskHandler


PORT = int(os.environ.get("PORT", 8000))


def main():
    server = HTTPServer(
        ("0.0.0.0", PORT),
        SmartTaskHandler
    )

    print("=" * 40)
    print("SmartTask3")
    print(f"Server running on port {PORT}")
    print("=" * 40)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Server stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()