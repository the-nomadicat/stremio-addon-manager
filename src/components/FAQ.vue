<template>
    <section id="faq">
        <h2>Frequently Asked Questions</h2>

        <details>
            <summary>
                What risks are involved?
            </summary>
            <p>
                This is an unofficial tool that talks directly to Stremio’s internal API. It is not endorsed by
                Stremio and it can absolutely break things if misused.
            </p>
            <p>
                You can now reorder addons, reorder catalogs, hide or show catalogs on the Home screen, and even edit
                an individual addon’s catalogs (rename them, delete them, change their order, and decide which ones
                appear). If you remove or corrupt something that Stremio expects to exist (for example, Cinemeta),
                parts of Stremio may stop working the way you expect.
            </p>
            <p>
                You can back up your current configuration and later restore it, so you <em>do</em> have a way
                to “reset” to a known good state — but only if you made a backup first. There is no built-in
                “factory reset to safe defaults,” and restoring the wrong backup can still make things worse.
                This tool is powerful, and in the wrong hands it’s destructive.
            </p>
        </details>

        <details>
            <summary>
                Are my credentials safe?
            </summary>
            <p>
                Mostly, yes — if you use it on a trusted personal device the way it’s intended.
            </p>
            <p>
                Here’s what actually happens:
            </p>
            <ul>
                <li>
                    Your Stremio email / password or AuthKey are used to authenticate directly with the Stremio API.
                </li>
                <li>
                    By default, that information lives only in the current browser session and disappears on refresh.
                </li>
                <li>
                    You can optionally enable “saved logins on this device.” If you turn that on, your login(s) —
                    including email, password, and AuthKey — are stored locally in <strong>this</strong> browser so
                    you can quickly switch between accounts later.
                </li>
                <li>
                    Nothing is uploaded to any server controlled by this tool.
                </li>
                <li>
                    Anyone with access to this browser profile / machine could reuse those saved credentials to act as
                    you in Stremio. Do <strong>not</strong> enable saved logins on a shared or public computer.
                </li>
            </ul>
            <p>
                If you're unsure, we highly encourage you to read the source code. There’s no hidden network call that
                exfiltrates credentials anywhere else.
            </p>
        </details>

        <details>
            <summary>
                What is the developer console and how do I open it?
            </summary>
            <p>
                The browser developer console is a built-in tool that shows network requests, errors, and lets you run
                JavaScript on the current page. You’ll use it if you want to manually copy your Stremio AuthKey from the
                official Stremio web app.
            </p>
            <p>
                To open it:
            </p>
            <ol>
                <li>
                    Go to
                    <a href="https://web.stremio.com/" target="_blank" rel="noopener noreferrer">
                        https://web.stremio.com/
                    </a>
                    and sign in.
                </li>
                <li>
                    Open the developer console in your browser:
                    <ul>
                        <li>Chrome / Edge / Brave / Opera: <code>Ctrl+Shift+I</code> (Windows/Linux) or <code>Cmd+Option+I</code> (macOS), then click the “Console” tab</li>
                        <li>Firefox: <code>Ctrl+Shift+K</code> (Windows/Linux) or <code>Cmd+Option+K</code> (macOS)</li>
                    </ul>
                </li>
                <li>
                    Paste:
                    <code>JSON.parse(localStorage.getItem("profile")).auth.key</code>
                </li>
                <li>
                    Copy the value and paste it into the AuthKey field in this tool.
                </li>
            </ol>
        </details>

        <details>
            <summary>
                Can I use this to move Cinemeta catalogs from the top?
            </summary>
            <p>
                Yes. You can reorder the default Cinemeta catalogs (for example, “Popular - Movies”, “Popular -
                Series”, “Featured - Movies”, “Featured - Series”) so they’re no longer forced to the very top of
                your catalog list.
            </p>
            <p>
                You can also hide those Cinemeta catalogs from the Stremio Home screen without uninstalling the
                Cinemeta addon itself — just use the Edit icon on the Cinemeta addon and then toggle the Home icon for any catalog you don’t want to see.
            </p>
            <p>
                However, the built-in top row for “Continue watching” is still controlled by Stremio and cannot be moved
                or hidden.
            </p>
        </details>
    </section>
</template>
