let express = require("express");
let app = express();
let cors = require("cors");
const CORS_OPTIONS = {
  origin: "http://localhost:3000",
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};
let cookieParser = require("cookie-parser");

let MongoClient = require("mongodb").MongoClient;
let ObjectID = require("mongodb").ObjectID;
let databaseAuthData = require("./DatabaseAuthData");
let multer = require("multer");
let upload = multer({});
let profileImageUpload = multer({ dest: __dirname + "/uploads/ProfileImages" });
let propertyImagesUpload = multer({
  dest: __dirname + "/uploads/PropertyImages"
});

let dbo = undefined;
MongoClient.connect(
  databaseAuthData.url,
  // { useNewUrlParser: true },
  { useUnifiedTopology: true },
  (err, db) => {
    dbo = db.db(databaseAuthData.dataBase);

    app.use(cookieParser()); //to access cookies
    app.use("/", express.static("build")); // Needed for the HTML and JS files
    app.use("/", express.static("public")); // Needed for local assets
    app.use(
      "/ProfileImages",
      express.static(__dirname + "/uploads/ProfileImages")
    );

    app.use(
      "/PropertyImages",
      express.static(__dirname + "/uploads/PropertyImages")
    );

    let returnedUser = user => {
      console.log("here");
      console.log(user);
      if (user === {} || user === undefined) {
        return {};
      }

      delete user.password;
      return user;
    };

    // get user login status endpoint (GET)
    app.get(
      "/user-login-status",
      cors(CORS_OPTIONS),
      upload.none(),
      (req, res) => {
        let _request = req;
        let _response = res;

        let _unsuccessfulResponseJSON = JSON.stringify({
          success: false,
          message: "User is not logged in!",
          user: {}
        });

        if (_request.cookies === undefined) {
          return _response.send(_unsuccessfulResponseJSON);
        }

        if (_request.cookies.sid === undefined) {
          return _response.send(_unsuccessfulResponseJSON);
        }

        let _sessionID = _request.cookies.sid;
        dbo
          .collection("users")
          .findOne({ _id: ObjectID(_sessionID) }, (err, user) => {
            if (err || user === null) {
              return _response.send(_unsuccessfulResponseJSON);
            }

            dbo.collection("users").updateOne(
              { _id: ObjectID(_sessionID) },
              {
                $set: {
                  dateOfLastLogin: Date(Date.now()).toString()
                }
              },
              (err, res) => {
                return _response.send(
                  JSON.stringify({
                    success: true,
                    message: "User is logged in!",
                    user: returnedUser(user)
                  })
                );
              }
            );
          });
      }
    );

    // signup new user endpoint (POST)
    app.post("/signup-user", cors(CORS_OPTIONS), upload.none(), (req, res) => {
      let _response = res;
      let _request = req;
      let _email = _request.body.email;
      let _password = _request.body.password;
      dbo.collection("users").findOne({ email: _email }, (err, user) => {
        if (user !== null) {
          return _response.send(
            JSON.stringify({
              success: false,
              message: "User already exists"
            })
          );
        }

        try {
          dbo.collection("users").insertOne(
            {
              email: _email,
              password: _password,
              dateCreated: Date(Date.now()).toString(),
              dateOfLastLogin: Date(Date.now()).toString(),
              hasListedProperty: false,
              userType: "user",
              profileImageURL: null
            },
            (err, user) => {
              _response.cookie("sid", user["ops"][0]._id);
              _response.send(
                JSON.stringify({
                  success: true,
                  message: "Sign up successful!",
                  user: returnedUser(user["ops"][0])
                })
              );
            }
          );
        } catch (e) {
          return _response.send(
            JSON.stringify({
              success: false,
              message: e.toString()
            })
          );
        }
      });
    });

    // login user endpoint (POST)
    app.post("/login-user", cors(CORS_OPTIONS), upload.none(), (req, res) => {
      let _response = res;
      let _request = req;
      let _email = _request.body.email;
      let _password = _request.body.password;
      dbo.collection("users").findOne({ email: _email }, (err, user) => {
        if (err) {
          return _response.send(
            JSON.stringify({
              success: false,
              message: "Login not successful. try again.",
              user: {}
            })
          );
        }
        if (user === null) {
          return _response.send(
            JSON.stringify({
              success: false,
              message: "User does not exist",
              user: {}
            })
          );
        }
        if (user.password === _password) {
          dbo.collection("users").updateOne(
            { _id: user._id },
            {
              $set: {
                dateOfLastLogin: Date(Date.now()).toString()
              }
            },
            (err, res) => {
              _response.cookie("sid", user._id.toString);
              console.log(_response.cookie());
              return _response.send(
                JSON.stringify({
                  success: true,
                  message: "Login successful",
                  user: returnedUser(user)
                })
              );
            }
          );
        } else {
          _response.send(
            JSON.stringify({
              success: false,
              message: "Email or password is incorrect",
              user: {}
            })
          );
        }
      });
    });

    //logout user (GET)
    app.get("/logout", cors(CORS_OPTIONS), (req, res) => {
      let _response = res;
      let _request = req;
      dbo
        .collection("cart")
        .deleteOne({ cartID: ObjectID(_request.cookies.sid) });

      _response.clearCookie("sid");
      _response.send(
        JSON.stringify({
          success: true,
          message: "Logout successful!"
        })
      );
    });

    // profile upload endpoint (POST)
    app.post(
      "/upload-profile",
      cors(CORS_OPTIONS),
      profileImageUpload.single("file"),
      (req, res) => {
        let _response = res;
        let _request = req;

        if (_request.cookies === undefined || _request.body === undefined) {
          return _response.send(
            JSON.stringify({
              success: false,
              message:
                _request.cookies === undefined
                  ? "Log in or Sign up to create profile!"
                  : _request.body === undefined
                  ? "No data submitted"
                  : "Something went wrong"
            })
          );
        }
        let _formInputData = _request.body;
        let _profileImage = _request.file === undefined ? null : _request.file;
        let _sessionID = _request.cookies.sid;

        let _firstName = _formInputData.firstName;
        let _lastName = _formInputData.lastName;
        let _phoneNumber = _formInputData.phoneNumber;
        let _address = _formInputData.address;
        let _country = _formInputData.country;
        let _state = _formInputData.state;
        let _zipCode = _formInputData.zipCode;
        let _accountName = _formInputData.accountName;
        let _bankName = _formInputData.bankName;
        let _routingNumber = _formInputData.routingNumber;
        let _accountNumber = _formInputData.accountNumber;
        let _userType = _formInputData.userType;
        let _profileImageURL =
          _profileImage === null
            ? null
            : "/ProfileImages/" + _profileImage.filename;

        try {
          dbo.collection("users").updateOne(
            { _id: ObjectID(_sessionID) },
            {
              $set: {
                userType: _userType,
                firstName: _firstName,
                lastName: _lastName,
                phoneNumber: _phoneNumber,
                address: _address,
                country: _country,
                state: _state,
                zipCode: _zipCode,
                accountName: _accountName,
                bankName: _bankName,
                routingNumber: _routingNumber,
                accountNumber: _accountNumber,
                profileImageURL: _profileImageURL,
                dateOfJoinedAsVendor: Date(Date.now()).toString()
              }
            },
            (err, res) => {
              dbo
                .collection("users")
                .findOne({ _id: ObjectID(_sessionID) }, (err, user) => {
                  return _response.send(
                    JSON.stringify({
                      success: true,
                      message: "Vendor profile updated successfully!",
                      user: returnedUser(user)
                    })
                  );
                });
            }
          );
        } catch (e) {
          _response.send(
            JSON.stringify({
              success: false,
              message: e.toString()
            })
          );
          return;
        }
      }
    );

    // property data upload endpoint (POST)
    app.post(
      "/property-data-upload",
      cors(CORS_OPTIONS),
      propertyImagesUpload.array("property-images", 50),
      (req, res) => {
        let _response = res;
        let _request = req;

        if (_request.cookies === undefined || _request.body === undefined) {
          return _response.send(
            JSON.stringify({
              success: false,
              message:
                _request.cookies === undefined
                  ? "Login/Signup to upload your property data!"
                  : _request.body === undefined
                  ? "No data to upload"
                  : "Something went wrong"
            })
          );
        }

        let _sessionID = _request.cookies.sid;

        let _propertyDetailsData = _request.body;
        let _propertyImageFileURLs = [];

        _request.files.map(file => {
          _propertyImageFileURLs.push("/PropertyImages/" + file.filename);
        });

        let _property = _propertyDetailsData.property
          ? _propertyDetailsData.property
          : "";
        let _propertyType = _propertyDetailsData.propertyType
          ? _propertyDetailsData.propertyType
          : "";
        let _roomDetails = _propertyDetailsData.roomDetails
          ? _propertyDetailsData.roomDetails
          : "";
        let _featuresList = _propertyDetailsData.featuresList
          ? JSON.parse(_propertyDetailsData.featuresList)
          : [];
        let _propertyLeaseType = _propertyDetailsData.propertyLeaseType
          ? _propertyDetailsData.propertyLeaseType
          : "";
        let _paymentInterval = _propertyDetailsData.paymentInterval
          ? _propertyDetailsData.paymentInterval
          : "";
        let _price = _propertyDetailsData.price
          ? JSON.parse(_propertyDetailsData.price)
          : 0.0;
        let _minimumRentalPeriod = _propertyDetailsData.minimumRentalPeriod
          ? JSON.parse(_propertyDetailsData.minimumRentalPeriod)
          : 1;
        let _title = _propertyDetailsData.title
          ? _propertyDetailsData.title
          : "";
        let _status = _propertyDetailsData.status
          ? _propertyDetailsData.status
          : "";
        let _description = _propertyDetailsData.description
          ? _propertyDetailsData.description
          : "";
        let _country = _propertyDetailsData.country
          ? _propertyDetailsData.country
          : "";
        let _state = _propertyDetailsData.state
          ? _propertyDetailsData.state
          : "";
        let _city = _propertyDetailsData.city ? _propertyDetailsData.city : "";
        let _address = _propertyDetailsData.address
          ? _propertyDetailsData.address
          : "";
        let _zipCode = _propertyDetailsData.zipCode
          ? _propertyDetailsData.zipCode
          : "";

        dbo
          .collection("users")
          .findOne({ _id: ObjectID(_sessionID) }, (err, user) => {
            try {
              dbo
                .collection("properties")
                .insertOne({
                  vendorUserID: user._id,
                  vendorFirstName: user.firstName,
                  vendorLastName: user.lastName,
                  reserved: false,
                  property: _property,
                  propertyType: _propertyType,
                  roomDetails: _roomDetails,
                  featuresList: _featuresList,
                  forSale: _propertyLeaseType === "For Sale",
                  paymentInterval: _paymentInterval,
                  price: _price,
                  minimumRentalPeriod: _minimumRentalPeriod,
                  title: _title,
                  newProperty: _status === "yes",
                  description: _description,
                  country: _country,
                  state: _state,
                  city: _city,
                  address: _address,
                  zipCode: _zipCode,
                  furnished: _featuresList.includes("furnished"),
                  propertyMainImageURL:
                    "/PropertyImages/" + _request.files[0]["filename"],
                  propertyImageFileURLs: _propertyImageFileURLs,
                  datePropertyUploaded: Date(Date.now()).toString(),
                  taken: false,
                  customerUserID: null,
                  dateTaken: null,
                  published: true,
                  views: 0,
                  reviews: 0,
                  totalPaid: 0
                })
                .then(res => {
                  return _response.send(
                    JSON.stringify({
                      success: true,
                      message: "Property uploaded"
                    })
                  );
                });
            } catch (e) {
              return _response.send(
                JSON.stringify({
                  success: false,
                  message: e.toString()
                })
              );
            }
          });
      }
    );

    //get all properties (GET)
    app.get("/all-properties", cors(CORS_OPTIONS), (req, res) => {
      let _response = res;

      dbo
        .collection("properties")
        .find({})
        .toArray((err, properties) => {
          if (err) {
            _response.send(
              JSON.stringify({
                success: false,
                message: "unable to fetch listed properties",
                properties: []
              })
            );
          } else {
          }
          _response.send(
            JSON.stringify({
              success: true,
              message: "successfully fetched all listed properties",
              properties: properties
            })
          );
        });
    });

    //get vendor properties (GET)
    app.get("/vendor-properties", cors(CORS_OPTIONS), (req, res) => {
      let _request = req;
      let _response = res;
      let _sessionID = _request.cookies.sid;

      dbo
        .collection("properties")
        .find({ vendorUserID: ObjectID(_sessionID) })
        .toArray((err, properties) => {
          if (err) {
            _response.send(
              JSON.stringify({
                success: false,
                message: "unable to fetch listed properties by vendor",
                properties: []
              })
            );
          } else {
          }
          _response.send(
            JSON.stringify({
              success: true,
              message: "successfully fetched all properties listed by vendor",
              properties: properties
            })
          );
        });
    });

    //get property by ID (GET)
    app.get("/property-by-id", cors(CORS_OPTIONS), (req, res) => {
      let _request = req;
      let _response = res;
      let _propertyID = _request.query.propertyID;

      dbo
        .collection("properties")
        .find({ _id: ObjectID(_propertyID) })
        .toArray((err, properties) => {
          if (err) {
            _response.send(
              JSON.stringify({
                success: false,
                message: "unable to fetch the property",
                properties: []
              })
            );
          } else {
          }
          _response.send(
            JSON.stringify({
              success: true,
              message: "successfully fetched the property",
              properties: properties
            })
          );
        });
    });

    //Search by random string (GET)
    app.get("/search-by-random-string", cors(CORS_OPTIONS), (req, res) => {
      let _request = req;
      let _response = res;
      let _criteria = _request.query.criteria;
      let _query = [
        { country: _criteria },
        { state: _criteria },
        { city: _criteria }
      ];

      dbo
        .collection("properties")
        .find({ $or: _query })
        .toArray((err, properties) => {
          if (err) {
            return _response.send(
              JSON.stringify({
                success: false,
                message: "no data returned",
                properties: []
              })
            );
          }

          return _response.send(
            JSON.stringify({
              success: true,
              message: "properties returned matching the criteria",
              properties: properties
            })
          );
        });
    });

    // update things endpoint (POST)
    // app.get("/update-things", cors(CORS_OPTIONS), upload.none(), (req, res) => {
    //   try {
    //     dbo.collection("properties").updateMany(
    //       {},
    //       {
    //         $set: {
    //           reviewStars: 0
    //         }
    //       }
    //     );

    //     res.send(
    //       JSON.stringify({
    //         success: true,
    //         message: "okay"
    //       })
    //     );
    //   } catch (e) {
    //     res.send(
    //       JSON.stringify({
    //         success: false,
    //         message: e.toString()
    //       })
    //     );
    //     return;
    //   }
    // });

    //submit payment (POST)
    app.post(
      "/submit-payment",
      cors(CORS_OPTIONS),
      upload.none(),
      (req, res) => {
        let _request = req;
        let _response = res;

        if (_request.cookies === undefined) {
          return _response.send(
            JSON.stringify({
              success: false,
              message: "no active session, unable to make payment"
            })
          );
        }

        if (_request.body === undefined) {
          return _response.send(
            JSON.stringify({
              success: false,
              message: "no payment details"
            })
          );
        }

        let _sessionID = _request.cookies.sid;

        let _propertyID = _request.body.propertyID;
        let _vendorID = _request.body.vendorID;
        let _forSale = _request.body.forSale;

        let _rentPeriod = _request.body.rentPeriod;
        let _rentExpiryDate = _request.body.rentExpiryDate;

        try {
          dbo
            .collection("properties")
            .updateOne(
              { _id: ObjectID(_propertyID) },
              {
                $set: {
                  taken: true,
                  reserved: true,
                  customerUserID: _sessionID,
                  dateTaken: Date(Date.now()).toString()
                }
              }
            )
            .then(res => {
              dbo
                .collection("propertyTransactionHistory")
                .insertOne({
                  vendorUserID: _vendorID,
                  propertyID: _propertyID,
                  customerUserID: _sessionID,
                  datePropertyTaken: Date(Date.now()).toString(),
                  forSale: _forSale,
                  rentPeriod: _rentPeriod,
                  rentExpiryDate: _rentExpiryDate
                })
                .then(res => {
                  return _response.send(
                    JSON.stringify({
                      success: true,
                      message: "Property payment successful"
                    })
                  );
                });
            });
        } catch (e) {
          _response.send(
            JSON.stringify({
              success: false,
              message: e.toString()
            })
          );
          return;
        }
      }
    );

    app.all("/*", cors(CORS_OPTIONS), (req, res, next) => {
      // needed for react router
      res.sendFile(__dirname + "/build/index.html");
    });

    app.listen(4000, "0.0.0.0", () => {
      console.log("Server running on port 4000");
    });
  }
);
