import React from 'react';
import { Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api';

const ProtectedRoute = () => {
  const [authorized, setAuthorized] = useState(null); // null = checking, true/false = result
  const params = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/auth/admin/me');
        if (!cancelled && res && res.data && res.data.ok) {
          // Persist practitioner context for headers
          if (res.data.practitionerId) localStorage.setItem('practitionerId', res.data.practitionerId);
          if (res.data.practitionerSlug) localStorage.setItem('practitionerSlug', res.data.practitionerSlug);
          if (res.data.practitionerPublicSlug) localStorage.setItem('practitionerPublicSlug', res.data.practitionerPublicSlug);
          // If URL contains a slug and it's not mine, redirect to my own
          const urlSlug = params.slug;
          const mySlug = res.data.practitionerSlug;
          if (urlSlug && mySlug && urlSlug !== mySlug) {
            navigate(`/psychologist/${encodeURIComponent(mySlug)}`, { replace: true });
            return;
          }
          setAuthorized(true);
        } else if (!cancelled) {
          setAuthorized(false);
        }
      } catch (_) {
        if (!cancelled) setAuthorized(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (authorized === null) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span>Загрузка...</span>
      </div>
    );
  }

  return authorized ? <Outlet /> : <Navigate to="/psychologist" replace />;
};

export default ProtectedRoute;
