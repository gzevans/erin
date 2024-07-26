// Dependencies
import { useEffect, useMemo, useRef, useState } from "react";

// Components
import BottomNavbar from "./components/BottomNavbar";
import VideoCard from "./components/VideoCard";

// Assets
import { faCompactDisc } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./App.css";
import BlacklistManager from "./components/BlacklistManager";
import BottomMetadata from "./components/BottomMetadata";

const App = () => {
  // Misc - General niceties
  const _reloadPage = (evt) => {
    evt.preventDefault();
    window.location.reload();
  };
  const _makeHTTPHeaders = () => {
    const headers = { Accept: "application/json" };
    if (window.USE_SECRET && !secureHash)
      headers["Authorization"] = `Basic ${btoa(`Erin:${formSecret}`)}`;
    return headers;
  };
  const _clearStoredSecret = () => {
    localStorage.removeItem("erin_secret");
  };
  const _storeSecret = (s) => {
    localStorage.setItem("erin_secret", s);
  };
  const _hasStoredVideos = () => {
    let v = localStorage.getItem("erin_videos");
    if (!v) return false;
    v = JSON.parse(v);
    if (!v || v.length === 0) return false;
    return true;
  };
  const _storeVideos = (v) => {
    localStorage.setItem("erin_videos", JSON.stringify(v));
  };
  const _getStoredVideos = () => {
    const v = localStorage.getItem("erin_videos");
    if (!v) return [];
    return JSON.parse(v);
  };
  const _getBlacklist = () => {
    const l = localStorage.getItem("erin_blacklist");
    if (!l) return [];
    return JSON.parse(l);
  };
  const _addToBlackList = (v) => {
    let l = _getBlacklist();
    l = [...l, v];
    localStorage.setItem("erin_blacklist", JSON.stringify(l));
  };
  const _removeFromBlacklist = (v) => {
    let l = _getBlacklist();
    l = l.filter((_v) => v.url !== _v.url);
    localStorage.setItem("erin_blacklist", JSON.stringify(l));
  };
  const _isVideo = (file) =>
    ["mp4", "ogg", "webm"].includes(file.name.toLowerCase().split(".").at(-1));
  const _isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const _toAuthenticatedUrl = (url) => `${url}?hash=${secureHash}`;
  const _veryFirsPageTitle = useMemo(() => document.title, []);
  const _updatePageTitle = (video = null) => {
    if (video) {
      if (!_veryFirsPageTitle.includes("[VIDEO_TITLE]")) document.title = _veryFirsPageTitle;
      else document.title = _veryFirsPageTitle.replace("[VIDEO_TITLE]", video.title);
    } else if (window.USE_SECRET) document.title = "Erin - Authentication";
  };
  const _arraysAreEqual = (a, b) => {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    const _a = [...a].sort();
    const _b = [...b].sort();

    for (let i = 0; i < _a.length; ++i) if (_a[i] !== _b[i]) return false;
    return true;
  };
  const _shuffleArray = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };

  const _currentVideoIndex = () => (visibleIndexes.length === 2 ? 0 : visibleIndexes[1]);

  // Members - Form & Auth management
  const [autoconnect, setAutoconnect] = useState(false);
  const [hasEverSubmitted, setHasEverSubmitted] = useState(false);
  const [formSecret, setFormSecret] = useState("");
  const [secureHash, setSecureHash] = useState("");
  const handleInputSecret = (e) => setFormSecret(e.target.value);

  // Members - Cache management
  const [hasCache, setHasCache] = useState(false);

  // Member - Determines whether we are able to communicate with the remote server
  const [loading, setLoading] = useState(false);
  const [hasReachedRemoteServer, setHasReachedRemoteServer] = useState(false);

  // Member - Saves a { url , title } dictionary for every video discovered
  const [videos, setVideos] = useState([]);

  // Member - Trick to trigger state updates on localStorage updates
  const [blackListUpdater, setBlacklistUpdater] = useState(0);
  // Dynamically-computed - Visible videos
  const visibleVideos = useMemo(
    () =>
      videos.filter(
        (_v) =>
          !_getBlacklist()
            .map((v) => v.url)
            .includes(_v.url)
      ),
    [videos, blackListUpdater] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Member - Determines which videos are currently loaded and visible on screen
  const [visibleIndexes, setVisibleIndexes] = useState([]);

  // Member - Determines whether the audio is currently muted
  const [muted, setMuted] = useState(true);
  const toggleMute = () => setMuted(!muted);

  // Video control - Download the current video
  const download = () => {
    const url = visibleVideos[_currentVideoIndex()].url;

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = url.split("?")[0].split("/").pop();
    anchor.target = "_blank";

    document.body.appendChild(anchor);

    anchor.click();

    document.body.removeChild(anchor);
  };

  // Video control - Blacklist
  const container = useRef();
  const blacklist = () => {
    const currentIndex = _currentVideoIndex();
    const video = visibleVideos[currentIndex];
    _addToBlackList(video);

    if (currentIndex === visibleVideos.length - 1 && visibleVideos.length > 1) {
      container.current.scrollBy({ top: -1, left: 0, behavior: "smooth" });
      setTimeout(() => {
        setBlacklistUpdater((b) => b + 1);
      }, 1000);
    } else {
      setBlacklistUpdater((b) => b + 1);
      container.current.scrollBy({ top: 1, left: 0 });
    }
  };

  // Member - Manage blacklist UI
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const openBlacklist = () => {
    setBlacklistOpen(true);
  };
  const hideBlacklist = () => {
    setBlacklistOpen(false);
  };
  const removeFromBlacklist = (v) => {
    _removeFromBlacklist(v);
    setBlacklistUpdater((b) => b + 1);
  };

  // Member - Saves a ref to every video element on the page
  const videoRefs = useRef([]);
  const saveVideoRef = (index) => (ref) => {
    videoRefs.current[index] = ref;
  };

  // Method - Test connectivity with the remote server
  const attemptToReachRemoteServer = (evt) => {
    if (evt) evt.preventDefault();

    setLoading(true);

    if (evt) setHasEverSubmitted(true);

    fetch(`${window.PUBLIC_URL}/media/`, {
      method: "GET",
      cache: "no-cache",
      headers: _makeHTTPHeaders(),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((r) => {
        if (window.USE_SECRET) {
          _storeSecret(formSecret);
          setSecureHash(r.hash);
        }
        setHasReachedRemoteServer(true);
      })
      .catch((_) => {
        _clearStoredSecret();
        setHasReachedRemoteServer(false);
      })
      .finally((_) => {
        setLoading(false);
      });
  };

  // Method - Recursive video retrieval
  const _retrieveVideosRecursively = (path = "") => {
    return fetch(_toAuthenticatedUrl(`${window.PUBLIC_URL}/media/${path}`), {
      method: "GET",
      cache: "no-cache",
      headers: _makeHTTPHeaders(),
    })
      .then((r) => r.json())
      .then(
        (files) =>
          new Promise((res, rej) => {
            if (!files) return res([]);

            const _folders = files.filter((f) => f.is_dir);
            const _files = files
              .filter((f) => !f.is_dir)
              .map((f) => ({ ...f, url: `${path}${f.url.slice(2)}` }));

            const promises = _folders.map((f) => _retrieveVideosRecursively(`${path}${f.name}`));
            Promise.all(promises).then((results) => {
              res([...results.flat(), ..._files]);
            });
          })
      )
      .catch((_) => new Promise((res, rej) => res([])));
  };

  // Method - Retrieve all the video links
  const retrieveVideos = () => {
    if (!hasCache) setLoading(true);

    let startingPath = window.location.pathname.slice(1);
    if (startingPath.length > 1 && !startingPath.endsWith("/")) startingPath += "/";

    _retrieveVideosRecursively(startingPath).then((files) => {
      if (!files) setLoading(false);

      let _videoFiles = files
        .filter((f) => _isVideo(f))
        .map((v) => ({
          url: _toAuthenticatedUrl(`${window.PUBLIC_URL}/media/${v.url}`),
          title: v.name
            .replaceAll("-", " ")
            .replaceAll("__", " - ")
            .split(".")
            .slice(0, -1)
            .join(""),
          extension: v.url.split(".").at(-1).toLowerCase(),
        }));
      _shuffleArray(_videoFiles);

      // Fix for Safari : .ogg files are not supported
      if (_isSafari) _videoFiles = _videoFiles.filter((f) => f.extension !== "ogg");

      setVideos((freshVideos) => {
        if (!hasCache) return _videoFiles;
        else if (hasCache && !_arraysAreEqual(_videoFiles, freshVideos))
          return [
            ...freshVideos,
            ..._videoFiles.filter((f) => !freshVideos.some((v) => v.url === f.url)),
          ];
      });
      _storeVideos(_videoFiles);

      // Load the first two videos
      if (!hasCache) {
        setVisibleIndexes([0, 1]);

        setLoading(false);
      }
    });
  };

  // Hook - On mount - Retrieve the locally-stored secret / Attempt to hide the address bar / Retrieve the cache if any
  useEffect(() => {
    window.onload = () => {
      setTimeout(() => {
        window.scrollTo(0, 1);
      }, 0);
    };

    _updatePageTitle();

    if (_hasStoredVideos()) setHasCache(true);

    if (!window.USE_SECRET) {
      setAutoconnect(true);
      return;
    }

    const storedSecret = localStorage.getItem("erin_secret");

    if (!storedSecret || storedSecret.length === 0) return;

    setFormSecret(storedSecret);
    setAutoconnect(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hook - When locally-stored secret was retrieved - Auto-connect to the remote server
  useEffect(() => {
    if (!autoconnect) return;

    attemptToReachRemoteServer();
  }, [autoconnect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hook - When the remote server was reached and the user was authenticated - Retrieve the videos
  useEffect(() => {
    if (!hasReachedRemoteServer) return;

    if (hasCache) {
      setLoading(true);
      setVideos(_getStoredVideos());
      setVisibleIndexes([0, 1]);
      setLoading(false);
    }

    retrieveVideos();
  }, [secureHash, hasReachedRemoteServer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hook - When videos are loaded - Set up the UI scroll observer
  useEffect(() => {
    // Default observer options
    const observerOptions = {
      root: null,
      rootMargin: "0px",
      threshold: 0.8,
    };

    // Listener called when scroll is performed
    const handleIntersection = (entries) => {
      // Trick to always retrieve fresh state, rather than closure-scoped one
      setVisibleIndexes((_visibleIndexes) => {
        let visibleIndex = false;

        entries.forEach((entry) => {
          const videoElement = entry.target;
          const currentIndex = parseInt(videoElement.getAttribute("data-index"));

          // Case when a video is scroll-snapped and occupies the screen
          if (entry.isIntersecting) {
            visibleIndex = currentIndex;
            videoElement.play().catch(_ => {});
            _updatePageTitle(videos[currentIndex]);
          }
          // Case when a video is off-screen or being scrolled in / out of the screen
          else {
            if (!_visibleIndexes.includes(currentIndex)) return;
            videoElement.pause();
          }
        });

        if (visibleIndex === false) return _visibleIndexes;

        return [
          visibleIndex - 1,
          visibleIndex,
          visibleIndex + 1,
          visibleIndex + 2,
          visibleIndex + 3,
        ];
      });
    };

    // Set up the observer
    const observer = new IntersectionObserver(handleIntersection, observerOptions);

    // Attach the observer to every video component
    for (let i = 0; i < videoRefs.current.length; i++)
      if (videoRefs.current[i]) observer.observe(videoRefs.current[i]);

    // Disconnect the observer when unmounting
    return () => {
      observer.disconnect();
    };
  }, [videos, blackListUpdater]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen">
      <div className="container" ref={container}>
        {/* STATE - Loading */}
        {loading && (
          <div className="loading-state">
            <FontAwesomeIcon icon={faCompactDisc} />
          </div>
        )}

        {!loading && (
          <>
            {/* STATE - Hasn't reached remote server */}
            {!hasReachedRemoteServer && (
              <>
                {window.USE_SECRET && (
                  <div className="login-state">
                    <div className="icon-wrapper">
                      <img src={`/logo.png`} alt="Erin logo" />
                    </div>
                    <h1>Welcome to Erin</h1>
                    <p>Let's connect and watch a few clips</p>
                    <form onSubmit={attemptToReachRemoteServer}>
                      <label htmlFor="password">Your password</label>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Please fill in your secure password"
                        onInput={handleInputSecret}
                      />
                      <button type="submit">Connect</button>
                      {hasEverSubmitted && <p className="form-error">Wrong password</p>}
                    </form>
                  </div>
                )}
              </>
            )}

            {/* STATE - Reached remote server but no video was found */}
            {hasReachedRemoteServer && visibleVideos.length === 0 && (
              <div className="empty-state">
                <div className="icon-wrapper">
                  <img src={`/logo.png`} alt="Erin logo" />
                </div>
                <h1>Nothing to watch</h1>
                <p>No video was found on your remote server</p>
                <button type="button" onClick={_reloadPage}>
                  Refresh
                </button>

                {_getBlacklist().length > 0 && (
                  <>
                    <button type="button" className="btn-alternate" onClick={openBlacklist}>
                      Manage masked videos
                    </button>
                    <BlacklistManager
                      visible={blacklistOpen}
                      videos={_getBlacklist()}
                      onClose={hideBlacklist}
                      onUnmask={removeFromBlacklist}
                    />
                  </>
                )}
              </div>
            )}

            {/* STATE - Reached remote server and retrieved videos */}
            {hasReachedRemoteServer && visibleVideos.length > 0 && (
              <>
                {visibleVideos.map((video, index) => (
                  <VideoCard
                    key={video.url}
                    index={index}
                    title={video.title}
                    url={video.url}
                    isLoaded={visibleIndexes.includes(index)}
                    isMuted={muted}
                    refForwarder={saveVideoRef(index)}
                  />
                ))}
                <BottomMetadata video={visibleVideos[_currentVideoIndex()]} />
                <BottomNavbar
                  onDownload={download}
                  onToggleMute={toggleMute}
                  isMuted={muted}
                  onBlacklist={blacklist}
                  onOpenBlacklist={openBlacklist}
                />
                <BlacklistManager
                  visible={blacklistOpen}
                  videos={_getBlacklist()}
                  onClose={hideBlacklist}
                  onUnmask={removeFromBlacklist}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
