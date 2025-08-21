import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Braav Challenge Coin Forum | Share, Discover, & Connect with Coin Enthusiasts',
  description: 'Join the Braav Challenge Coin Platform, an online community for collectors and enthusiasts. Share your collection, discover rare coins, and connect with others passionate about challenge coins. Explore the world of challenge coins today!',
  openGraph: {
    title: 'Braav Challenge Coin Forum | Share, Discover, & Connect with Coin Enthusiasts',
    description: 'Join the Braav Challenge Coin Platform, an online community for collectors and enthusiasts. Share your collection, discover rare coins, and connect with others passionate about challenge coins. Explore the world of challenge coins today!',
    images: [
      {
        url: 'https://media-hosting.imagekit.io/7a2f1b32abc34d8b/pexels-lasfotosdepipe-13694807%20(1).jpg?Expires=1838349781&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=C2NA8sHzFsM-~f9tvN1viHxDlROysscw3fJCgrCFtVsKLhqgLvg2XkXKl3cYl0tHe8LD7Q-QKNm6U61WChssYa-swZiuw5n6yctw1ifSgBAKuZ-Ye~76jpd9Tnxa5Y9IUipGfsocKS1kP6OQpWURpm7VVfq3EF8r5WD0ahVenGVUh5Y-zBxWDqTuIYgfvytz7qSIv6wdj4rYLhLudcHHCLd6y7xnE6srxb2W-8lo-04MR718XUAzfqaqKt5Xs4bY8RW4741nwAHNPuSygeZLK-p3mSJhEWlmk2m7g0z0YWweO080FwhnlhByiw2ZHvd3KUQgvpl7EMN9jll6TXc-5w__',
        width: 1200,
        height: 630,
      },
    ],
    type: 'website',
    url: 'https://coin.braav.co',
    siteName: 'Braav Challenge Coins',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Braav Challenge Coin Forum | Share, Discover, & Connect with Coin Enthusiasts',
    description: 'Join the Braav Challenge Coin Platform, an online community for collectors and enthusiasts. Share your collection, discover rare coins, and connect with others passionate about challenge coins. Explore the world of challenge coins today!',
    images: ['https://media-hosting.imagekit.io/7a2f1b32abc34d8b/pexels-lasfotosdepipe-13694807%20(1).jpg?Expires=1838349781&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=C2NA8sHzFsM-~f9tvN1viHxDlROysscw3fJCgrCFtVsKLhqgLvg2XkXKl3cYl0tHe8LD7Q-QKNm6U61WChssYa-swZiuw5n6yctw1ifSgBAKuZ-Ye~76jpd9Tnxa5Y9IUipGfsocKS1kP6OQpWURpm7VVfq3EF8r5WD0ahVenGVUh5Y-zBxWDqTuIYgfvytz7qSIv6wdj4rYLhLudcHHCLd6y7xnE6srxb2W-8lo-04MR718XUAzfqaqKt5Xs4bY8RW4741nwAHNPuSygeZLK-p3mSJhEWlmk2m7g0z0YWweO080FwhnlhByiw2ZHvd3KUQgvpl7EMN9jll6TXc-5w__'],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-G5BNDDXMSP"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-G5BNDDXMSP');
            `,
          }}
        />
        <script defer src="https://widget-js.cometchat.io/v3/cometchatwidget.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                      console.log('ServiceWorker registration successful');
                    })
                    .catch(err => {
                      console.log('ServiceWorker registration failed: ', err);
                    });
                });
              }
            `,
          }}
        />
        <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.OneSignalDeferred = window.OneSignalDeferred || [];
              OneSignalDeferred.push(async function(OneSignal) {
                await OneSignal.init({
                  appId: "1856fc99-b472-4e6d-9fef-473d76460aa3",
                });
              });
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}