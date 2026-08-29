// =========================================================
// SmartTask3 Notification Service Worker
// =========================================================


// ---------------------------------------------------------
// نصب Service Worker
// ---------------------------------------------------------

self.addEventListener(
    "install",
    event => {

        self.skipWaiting();

    }
);


// ---------------------------------------------------------
// فعال شدن Service Worker
// ---------------------------------------------------------

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(
            self.clients.claim()
        );

    }
);


// ---------------------------------------------------------
// کلیک روی Notification
// ---------------------------------------------------------

self.addEventListener(
    "notificationclick",
    event => {

        event.notification.close();


        event.waitUntil(

            clients.matchAll({
                type: "window",
                includeUncontrolled: true
            })
            .then(clientList => {

                for (
                    const client of clientList
                ) {

                    if (
                        "focus" in client
                    ) {

                        return client.focus();
                    }
                }


                if (
                    clients.openWindow
                ) {

                    return clients.openWindow(
                        "/"
                    );
                }

            })

        );
    }
);