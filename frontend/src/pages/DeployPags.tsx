import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import CodeIcon from '@mui/icons-material/Code';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import axios from 'axios';
import { io } from "socket.io-client";

const socket = io("http://localhost:9002");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Copyright(props: any) {
  return (
    <Typography variant="body2" color="text.secondary" align="center" {...props}>
      {'Copyright © '}
      <Link color="inherit" href="https://mui.com/">
        SurgeSync
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

const defaultTheme = createTheme();

export default function Deploy() {
    const [repoURL, setRepoURL] = React.useState<string>('');
    const [deploymentId, setDeploymentId] = React.useState<string>('');
    const [logs, setLogs] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState<boolean>(false);
    const [deployPreviewURL, setDeployPreviewURL] = React.useState<string | undefined>();

    const logContainerRef = React.useRef<HTMLElement>(null);

    const isValidURL: [boolean, string | null] = React.useMemo(() => {
        if (!repoURL || repoURL.trim() === "") return [false, null];
        const regex = new RegExp(
          /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/
        );
        return [regex.test(repoURL), "Enter valid Github Repository URL"];
      }, [repoURL]);

    const handleCLickDeploy = async (event: React.FormEvent<HTMLFormElement>) => {
        setLoading(true);

        event.preventDefault();
        const data = new FormData(event.currentTarget);

        const res = await axios.post('http://localhost:9000/project', {
                name: data.get('projectName'),
                gitURL: data.get('gitURL'),
        });

        const finalRes = res.data;

        if (!finalRes) {
            return;
        }

        const { subDomain, id } = finalRes.data;

        const deploymentRes = await axios.post('http://localhost:9000/deploy', {
            projectId: id,
            subDomain,
        });

        socket.emit("subscribe", `logs:${subDomain}`);

        const finalDeploymentRes = deploymentRes.data;
        setDeploymentId(prevId => finalDeploymentRes.data.deploymentId);
        setDeployPreviewURL(prevURL => finalDeploymentRes.data.url);

    };

    const handleSocketIncommingMessage = React.useCallback((log: string) => {
        console.log(`[Incomming Socket Message]:`, typeof log, log);
        setLogs((prev) => [...prev, log]);
        logContainerRef.current?.scrollIntoView({ behavior: "smooth" });
      }, []);
    
      React.useEffect(() => {
        socket.on("log", handleSocketIncommingMessage);
    
        return () => {
          socket.off("log", handleSocketIncommingMessage);
        };
      }, [handleSocketIncommingMessage]);

    return (
        <ThemeProvider theme={defaultTheme}>
         <Container component="main" maxWidth="xs">
        <CssBaseline />
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
            <CodeIcon />
          </Avatar>
          <Typography component="h1" variant="h5">
            Surge Sync
          </Typography>
          <Box component="form" onSubmit={handleCLickDeploy} noValidate sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              disabled={loading}
              id="projectName"
              label="Project Name"
              name="projectName"
              autoComplete="projectName"
              autoFocus
            />
            <TextField
              margin="normal"
              required
              fullWidth
              disabled={loading}
              type="url"
              value={repoURL}
              onChange={e => {
                setRepoURL(e.target.value)
              }}
              name="gitURL"
              label="Github URL"
              id="gitURL"
              autoComplete="gitURL"
            />

            <Button
              type="submit"
              disabled={!isValidURL[0] || loading}
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              {loading ? "In Progress" : "Deploy"}
            </Button>
            {deployPreviewURL && (
                <div>
                    <p>
                        Preview URL {" "}
                        <a href={deployPreviewURL}
                        target='blank'
                        > {deployPreviewURL}</a>
                    </p>
                </div>
            )}
            {logs.length > 0 && (
                <div
                    className={`text-sm text-green-500 logs-container mt-5 border-green-500 border-2 rounded-lg p-4 h-[300px] overflow-y-auto`}
                >
                <pre className="flex flex-col gap-1">
                {logs.map((log, i) => (
                <code
                    ref={logs.length - 1 === i ? logContainerRef : undefined}
                    key={i}
                >{`> ${log}`}</code>
                ))}
                </pre>
                </div>
            )}
          </Box>
        </Box>
        <Copyright sx={{ mt: 8, mb: 4 }} />
      </Container>
    </ThemeProvider>
  );
}