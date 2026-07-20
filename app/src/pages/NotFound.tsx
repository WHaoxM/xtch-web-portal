import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="section-padding bg-white py-32">
      <div className="content-max-width max-w-3xl">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#379C8A]">
          404
        </p>
        <h1 className="mt-4 font-serif text-[42px] leading-tight text-[#002A3A]">
          Page not found
        </h1>
        <p className="mt-4 text-[15px] leading-8 text-[#5D5D5D]">
          This URL is not part of Syncing Travel’s published pages. Choose a destination or route
          below to continue planning.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-[4px] bg-[#002A3A] px-5 py-3 text-[14px] font-semibold text-white"
          >
            Back to home
          </Link>
          <Link
            to="/china-trips"
            className="inline-flex items-center justify-center rounded-[4px] border border-[#002A3A]/20 px-5 py-3 text-[14px] font-semibold text-[#002A3A]"
          >
            Browse China trips
          </Link>
          <Link
            to="/destinations"
            className="inline-flex items-center justify-center rounded-[4px] border border-[#002A3A]/20 px-5 py-3 text-[14px] font-semibold text-[#002A3A]"
          >
            Destinations
          </Link>
        </div>
      </div>
    </div>
  );
}
