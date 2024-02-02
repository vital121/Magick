import { FrigadeAnnouncement, FrigadeProvider as FrigadeProviderOG } from "@frigade/react";
import { useNavigate } from "react-router-dom";
import { FRIGADE_KEY } from 'shared/config'
import { useSelector } from "react-redux"


type Props = {
  children: React.ReactNode;
};

const FrigadeProvider = ({ children }: Props) => {
  const globalConfig = useSelector((state: any) => state.globalConfig)
  const navigate = useNavigate();

  console.log("FRIGADE_KEY", FRIGADE_KEY)

  return (
    <FrigadeProviderOG
      publicApiKey={FRIGADE_KEY || ""}
      userId={globalConfig?.userId || "anonymous"}
      config={{
        navigate: (url, target): void => {
          if (target === "_blank") {
            window.open(url, "_blank");
          } else {
            navigate(url);
          }
        },
        defaultAppearance: {
          theme: {
            colorText: "white !important",
            colorTextSecondary: "white",
            colorTextOnPrimaryBackground: "#fff",
            colorPrimary: "#1BC5EB",
            colorBackground: "#262b2e",
          },
          styleOverrides: {
            button: {
              border: "none",
              outline: "none",
            },
          },
        },
      }}
    >
      <FrigadeAnnouncement
        flowId='flow_8ZIGBYvK0fP6r4Fa'
        modalPosition="center"
      />
      {children}
    </FrigadeProviderOG>
  );
};

export default FrigadeProvider;