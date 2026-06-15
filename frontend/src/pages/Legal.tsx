import { MarketingNav, MarketingFooter } from '../marketing/Marketing';

const CONTENT = {
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Acceptance', 'By creating a HartHome household you agree to these terms. HartHome is a family organization tool provided as-is to help you run your home.'],
      ['Your household', 'You are responsible for the members you invite and the content you store. The household owner controls membership and settings.'],
      ['Acceptable use', 'Use HartHome lawfully and for managing your own home. Do not attempt to access other households’ data or disrupt the service.'],
      ['Data & availability', 'We aim for high availability but do not guarantee uninterrupted service. Keep independent records of critical information such as financial and legal documents.'],
      ['Changes', 'We may update these terms as the product evolves. Continued use after changes constitutes acceptance.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['What we store', 'HartHome stores the information you add — events, chores, lists, bills, budgets, assets, contacts, and household members — to provide the service to your family.'],
      ['Isolation', 'Every household’s data is isolated. Members of one household can never see another household’s information.'],
      ['Children', 'Parents and owners control child profiles. Child profiles can be created without an email and sign in on shared screens with no password.'],
      ['Security', 'Passwords are salted and hashed. Sessions are token-based and expire. We never sell your data.'],
      ['Your control', 'Owners can export or delete household data at any time. Removing a member revokes their access immediately.'],
    ],
  },
};

export default function Legal({ kind }: { kind: 'terms' | 'privacy' }) {
  const c = CONTENT[kind];
  return (
    <div className="bg-[#060911] text-white min-h-screen">
      <MarketingNav />
      <section className="pt-36 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold tracking-tight">{c.title}</h1>
          <p className="mt-3 text-sm text-gray-500">Last updated {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          <div className="mt-10 space-y-8">
            {c.sections.map(([h, b]) => (
              <div key={h}>
                <h2 className="text-lg font-semibold text-white">{h}</h2>
                <p className="mt-2 text-gray-400 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-sm text-gray-500">Questions? Email <a href="mailto:hello@harthome.io" className="text-indigo-400 underline">hello@harthome.io</a>.</p>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
