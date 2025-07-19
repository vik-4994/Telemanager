import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1 p-4">
        {children}
      </div>
    </div>
  );
}
